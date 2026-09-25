// All trade popups (list, offer, buy/sweep, accept, cancel) with step-by-step progress.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAccount, useBalance, useReadContract, useSignMessage } from 'wagmi';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import {
  acceptOffer, buyListings, cancelOrder, errorMessage, listItem, makeOffer, quote, stepLabel, wrapEth,
  type ActionCtx, type StepKey,
} from '../lib/actions';
import { wethAbi } from '../lib/abis';
import { bpsFee, eth, shortId, tokenLabel, toWei } from '../lib/format';
import type { Address, Collection, DropState, Order, Token } from '../lib/types';
import { CollectionAvatar, TokenArt } from './Art';
import { IconAlert, IconCheck } from './Icons';
import { Modal, useToast } from './ui';
import { useWalletUI } from './wallet';

type TradeState =
  | { kind: 'list'; col: string; token: Token }
  | { kind: 'offer'; col: string; token?: Token }
  | { kind: 'buy'; col: string; tokens: Token[] }
  | { kind: 'accept'; col: string; order: Order; token?: Token }
  | { kind: 'cancel'; col: string; order: Order }
  | null;

interface TradeAPI {
  list: (col: string, token: Token) => void;
  offer: (col: string, token?: Token) => void;
  buy: (col: string, tokens: Token[]) => void;
  accept: (order: Order, col: string, token?: Token) => void;
  cancel: (order: Order, col: string) => void;
}

const Ctx = createContext<TradeAPI>(null as unknown as TradeAPI);
export const useTrade = () => useContext(Ctx);

export function TradeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TradeState>(null);
  const { ensureReady } = useWalletUI();
  const open = useCallback(
    async (s: NonNullable<TradeState>) => {
      if (await ensureReady()) setState(s);
    },
    [ensureReady],
  );
  const api_ = useMemo<TradeAPI>(
    () => ({
      list: (col, token) => open({ kind: 'list', col, token }),
      offer: (col, token) => open({ kind: 'offer', col, token }),
      buy: (col, tokens) => open({ kind: 'buy', col, tokens }),
      accept: (order, col, token) => open({ kind: 'accept', col, order, token }),
      cancel: (order, col) => open({ kind: 'cancel', col, order }),
    }),
    [open],
  );
  const close = () => setState(null);
  return (
    <Ctx.Provider value={api_}>
      {children}
      {state && <TradeModal state={state} onClose={close} />}
    </Ctx.Provider>
  );
}

// ── Runner: tracks wallet steps and result ───────────────────────────────────
type Phase = 'form' | 'running' | 'done' | 'error';

export function useRunner() {
  const cfg = useAppConfig();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('form');
  const [steps, setSteps] = useState<{ key: StepKey; done: boolean }[]>([]);
  const [error, setError] = useState('');

  const run = useCallback(
    async <R,>(fn: (ctx: ActionCtx) => Promise<R>): Promise<R | undefined> => {
      if (!address) return;
      setPhase('running');
      setSteps([]);
      setError('');
      const ctx: ActionCtx = {
        cfg,
        address: address as Address,
        signMessage: (message) => signMessageAsync({ message }),
        progress: (key) =>
          setSteps((s) => {
            const prev = s.map((x) => ({ ...x, done: true }));
            return prev.some((x) => x.key === key) ? prev.map((x) => (x.key === key ? { ...x, done: false } : x)) : [...prev, { key, done: false }];
          }),
      };
      try {
        const out = await fn(ctx);
        setSteps((s) => s.map((x) => ({ ...x, done: true })));
        setPhase('done');
        qc.invalidateQueries();
        return out;
      } catch (e) {
        setError(errorMessage(e, t));
        setPhase('error');
      }
    },
    [address, cfg, signMessageAsync, qc, t],
  );

  const reset = () => { setPhase('form'); setSteps([]); setError(''); };
  return { phase, steps, error, run, reset, busy: phase === 'running' };
}

export function StepList({ steps }: { steps: { key: StepKey; done: boolean }[] }) {
  const { t } = useI18n();
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s.key} className={s.done ? 'is-done' : 'is-active'}>
          <span className="step-dot">{s.done ? <IconCheck size={13} /> : <span className="spinner" style={{ width: 12, height: 12 }} />}</span>
          {t(stepLabel[s.key])}
        </li>
      ))}
    </ol>
  );
}

export function RunnerStatus({ runner, successText, onClose, extra }: { runner: ReturnType<typeof useRunner>; successText: string; onClose: () => void; extra?: ReactNode }) {
  const { t } = useI18n();
  if (runner.phase === 'running') return <StepList steps={runner.steps} />;
  if (runner.phase === 'done')
    return (
      <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>
        <div className="success-mark"><svg width="30" height="30" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <div className="h3">{successText}</div>
        {extra}
        <button className="btn btn--block" onClick={onClose}>{t('common.close')}</button>
      </div>
    );
  if (runner.phase === 'error')
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {runner.steps.length > 0 && <StepList steps={runner.steps.map((s, i, a) => ({ ...s, done: i < a.length - 1 }))} />}
        <div className="notice notice--strong"><IconAlert size={18} /><span>{runner.error}</span></div>
        <button className="btn btn--outline btn--block" onClick={runner.reset}>{t('common.retry')}</button>
      </div>
    );
  return null;
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function useCollection(key: string) {
  return useQuery({
    queryKey: ['collection', key.toLowerCase()],
    queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${key}`),
  });
}

function ItemPreview({ col, token }: { col: Collection; token?: Token }) {
  const { t } = useI18n();
  return (
    <div className="modal-item">
      <span className="thumb" style={{ position: 'relative' }}>
        {token ? <TokenArt collection={col} token={token} /> : <CollectionAvatar collection={col} />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="strong">{token ? tokenLabel(token.name, token.token_id) : t('col.anyItem')}</div>
        <div className="small muted">{col.name}</div>
      </div>
    </div>
  );
}

const DURATIONS = [1, 3, 7, 30];

function DurationPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="field">
      <span className="label">{t('list.duration')}</span>
      <div className="row-wrap">
        {DURATIONS.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={value === d} onClick={() => onChange(d)}>{t('list.days', { n: d })}</button>
        ))}
      </div>
    </div>
  );
}

function PriceInput({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <div className="field">
      <label htmlFor="price-input">{label}</label>
      <div className="input-wrap">
        <input
          id="price-input"
          className="input"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
          style={{ fontSize: 18, fontWeight: 700, height: 54 }}
        />
        <span className="suffix">{unit}</span>
      </div>
    </div>
  );
}

function SellerSummary({ priceWei, col, unit }: { priceWei: bigint | null; col: Collection; unit: string }) {
  const cfg = useAppConfig();
  const { t } = useI18n();
  const p = priceWei ?? 0n;
  const feeBps = cfg.marketFeeBps ?? 0;
  const fee = bpsFee(p, feeBps);
  const royalty = bpsFee(p, col.royalty_bps);
  return (
    <div className="sum-rows">
      <div><span className="muted">{t('common.marketFee')} ({feeBps / 100}%)</span><span className="mono-num">{eth(fee)} {unit}</span></div>
      <div><span className="muted">{t('common.royalty')} ({col.royalty_bps / 100}%)</span><span className="mono-num">{eth(royalty)} {unit}</span></div>
      <div className="total"><span>{t('common.youReceive')}</span><span className="mono-num">{eth(p - fee - royalty)} {unit}</span></div>
    </div>
  );
}

// ── Modal switch ─────────────────────────────────────────────────────────────
function TradeModal({ state, onClose }: { state: NonNullable<TradeState>; onClose: () => void }) {
  const { data } = useCollection(state.col);
  const runner = useRunner();
  const col = data?.collection;
  const common = { runner, onClose };
  if (!col) return <Modal open onClose={onClose} title=" "><div className="skeleton" style={{ height: 120 }} /></Modal>;
  switch (state.kind) {
    case 'list': return <ListModal {...common} col={col} token={state.token} />;
    case 'offer': return <OfferModal {...common} col={col} token={state.token} />;
    case 'buy': return <BuyModal {...common} col={col} tokens={state.tokens} />;
    case 'accept': return <AcceptModal {...common} col={col} order={state.order} token={state.token} />;
    case 'cancel': return <CancelModal {...common} col={col} order={state.order} />;
  }
}

type ModalProps = { runner: ReturnType<typeof useRunner>; onClose: () => void; col: Collection };

function ListModal({ runner, onClose, col, token }: ModalProps & { token: Token }) {
  const { t } = useI18n();
  const [price, setPrice] = useState(token.listing_price_wei ? eth(token.listing_price_wei, 6) : '');
  const [days, setDays] = useState(7);
  const wei = toWei(price);
  const valid = !!wei && wei > 0n;
  const raising = !!token.listing_price_wei && !!wei && wei > BigInt(token.listing_price_wei);
  const below = !!wei && !!col.floor_wei && wei < BigInt(col.floor_wei);

  async function submit() {
    if (!wei) return;
    await runner.run((ctx) => listItem(ctx, { collection: col, tokenId: token.token_id, priceWei: wei, days }));
  }

  return (
    <Modal open onClose={onClose} title={t('list.title')} locked={runner.busy}>
      {runner.phase === 'form' ? (
        <>
          <ItemPreview col={col} token={token} />
          <PriceInput label={t('list.price')} value={price} onChange={setPrice} unit="ETH" />
          {col.floor_wei && (
            <div className="row" style={{ justifyContent: 'space-between', marginTop: -8 }}>
              <span className="small muted">{t('list.floor', { price: eth(col.floor_wei) })}</span>
              <button className="chip" type="button" onClick={() => setPrice(eth(col.floor_wei, 6))}>{t('list.useFloor')}</button>
            </div>
          )}
          {below && <div className="notice"><IconAlert size={16} />{t('list.belowFloor')}</div>}
          {raising && <div className="notice"><IconAlert size={16} />{t('list.raiseWarn')}</div>}
          <DurationPicker value={days} onChange={setDays} />
          <SellerSummary priceWei={wei} col={col} unit="ETH" />
          <button className="btn btn--lg btn--block" disabled={!valid || raising} onClick={submit}>{t('list.confirm')}</button>
        </>
      ) : (
        <RunnerStatus runner={runner} successText={t('list.done')} onClose={onClose} />
      )}
    </Modal>
  );
}

function OfferModal({ runner, onClose, col, token }: ModalProps & { token?: Token }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const { address } = useAccount();
  const [price, setPrice] = useState('');
  const [days, setDays] = useState(7);
  const wei = toWei(price);
  const valid = !!wei && wei > 0n;
  const { data: weth, refetch } = useReadContract({
    address: cfg.weth as Address, abi: wethAbi, functionName: 'balanceOf', args: [address as Address], query: { enabled: !!address },
  });
  const { data: ethBal } = useBalance({ address, query: { enabled: !!address } });
  const { data: open } = useQuery({
    queryKey: ['offers-made', address],
    queryFn: () => api.get<{ orders: Order[] }>(`/users/${address}/offers-made`),
    enabled: !!address,
  });
  const outstanding = (open?.orders ?? []).reduce((s, o) => s + BigInt(o.price_wei), 0n);
  const shortfall = wei && weth !== undefined && wei > (weth as bigint) ? wei - (weth as bigint) : 0n;

  async function submit() {
    if (!wei) return;
    await runner.run((ctx) => makeOffer(ctx, { collection: col, tokenId: token?.token_id ?? null, priceWei: wei, days, outstandingWei: outstanding }));
  }
  async function wrap() {
    const ok = await runner.run((ctx) => wrapEth(ctx, shortfall));
    if (ok) {
      await refetch();
      runner.reset(); // back to the offer form with the new WETH balance
      toast(t('offer.wrapped'));
    }
  }

  return (
    <Modal open onClose={onClose} title={token ? t('offer.title') : t('offer.collectionTitle')} locked={runner.busy}>
      {runner.phase === 'form' ? (
        <>
          <ItemPreview col={col} token={token} />
          {!token && <p className="small soft">{t('offer.collectionBody')}</p>}
          <PriceInput label={t('offer.price')} value={price} onChange={setPrice} unit="WETH" />
          {col.best_offer_wei && <span className="small muted" style={{ marginTop: -8 }}>{t('offer.bestNow', { price: eth(col.best_offer_wei) })}</span>}
          {weth !== undefined && <span className="small soft">{t('offer.weth', { amount: eth(weth as bigint) })}</span>}
          {shortfall > 0n && (
            <div className="notice" style={{ alignItems: 'center' }}>
              <IconAlert size={16} />
              <span style={{ flex: 1 }}>{t('offer.needWrap', { amount: eth(shortfall) })}</span>
              <button className="btn btn--sm" disabled={!ethBal || ethBal.value < shortfall} onClick={wrap}>{t('offer.wrap', { amount: eth(shortfall) })}</button>
            </div>
          )}
          <DurationPicker value={days} onChange={setDays} />
          <div className="sum-rows">
            <div className="total"><span>{t('common.youPay')}</span><span className="mono-num">{eth(wei ?? 0n)} WETH</span></div>
          </div>
          <p className="tiny muted">{t('offer.approveNote')}</p>
          <button className="btn btn--lg btn--block" disabled={!valid || shortfall > 0n} onClick={submit}>{t('offer.confirm')}</button>
        </>
      ) : (
        <RunnerStatus runner={runner} successText={t('offer.done')} onClose={onClose} />
      )}
    </Modal>
  );
}

function BuyModal({ runner, onClose, col, tokens }: ModalProps & { tokens: Token[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const { address } = useAccount();
  const items = tokens.filter((x) => x.listing_hash);
  const total = items.reduce((s, x) => s + BigInt(x.listing_price_wei || 0), 0n);
  const { data: bal } = useBalance({ address });
  const short = !!bal && bal.value < total;
  const [result, setResult] = useState<{ bought: number; skipped: number } | null>(null);

  async function submit() {
    const out = await runner.run((ctx) => buyListings(ctx, items.map((x) => x.listing_hash!)));
    if (out) {
      setResult({ bought: out.bought.length, skipped: out.skipped });
      if (out.skipped) toast(t('buy.partial', { n: out.bought.length }), 'error');
    }
  }

  return (
    <Modal open onClose={onClose} title={items.length > 1 ? t('buy.sweepTitle', { n: items.length }) : t('buy.title')} locked={runner.busy}>
      {runner.phase === 'form' ? (
        <>
          <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {items.map((x) => (
              <div key={x.token_id} className="modal-item" style={{ padding: 10 }}>
                <span className="thumb thumb--sm" style={{ position: 'relative' }}><TokenArt collection={col} token={x} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strong small ellipsis">{tokenLabel(x.name, x.token_id)}</div>
                  <div className="tiny muted">{col.name}</div>
                </div>
                <span className="strong mono-num">{eth(x.listing_price_wei)} ETH</span>
              </div>
            ))}
          </div>
          <div className="sum-rows">
            <div><span className="muted">{t('common.items')}</span><span>{items.length}</span></div>
            <div className="total"><span>{t('common.total')}</span><span className="mono-num">{eth(total)} ETH</span></div>
          </div>
          <p className="tiny muted">{t('buy.fees')} {t('fee.wallet')}</p>
          {short && <div className="notice"><IconAlert size={16} />{t('wallet.balance')}: {eth(bal!.value)} ETH</div>}
          <button className="btn btn--lg btn--block" disabled={!items.length} onClick={submit}>
            {items.length > 1 ? t('col.sweepBuy', { n: items.length }) : t('buy.confirm')}
          </button>
        </>
      ) : (
        <RunnerStatus
          runner={runner}
          successText={t('buy.done')}
          onClose={onClose}
          extra={result && address ? <Link className="link small" to={`/profile/${address}`} onClick={onClose}>{t('drop.viewItems')}</Link> : null}
        />
      )}
    </Modal>
  );
}

function AcceptModal({ runner, onClose, col, order, token }: ModalProps & { order: Order; token?: Token }) {
  const { t } = useI18n();
  const { address } = useAccount();
  const needsChoice = order.kind === 'collection_offer' && !token;
  const [picked, setPicked] = useState<Token | undefined>(token);
  const { data: mine } = useQuery({
    queryKey: ['tokens', col.address, 'owner', address],
    queryFn: () => api.get<{ tokens: Token[] }>(`/collections/${col.address}/tokens`, { owner: address, sort: 'id_asc', limit: 60 }),
    enabled: needsChoice && !!address,
  });
  const chosen = picked ?? (order.kind === 'offer' ? ({ token_id: order.token_id!, name: order.token_name, image_url: order.token_image, attributes: order.token_attributes } as Token) : undefined);

  async function submit() {
    if (!chosen) return;
    await runner.run(async (ctx) => {
      // The seller's minimum comes from the contract's own quote, so fees can't change under you.
      const q = await quote(ctx.cfg, col.address, chosen.token_id, BigInt(order.price_wei));
      return acceptOffer(ctx, { order, tokenId: chosen.token_id, minProceeds: q.proceeds });
    });
  }

  return (
    <Modal open onClose={onClose} title={t('accept.title')} locked={runner.busy} width={needsChoice ? 560 : 480}>
      {runner.phase === 'form' ? (
        <>
          {needsChoice ? (
            <div className="field">
              <span className="label">{t('accept.choose')}</span>
              <div className="nft-grid nft-grid--small" style={{ maxHeight: 280, overflowY: 'auto', padding: 2 }}>
                {(mine?.tokens ?? []).map((x) => (
                  <button
                    key={x.token_id}
                    type="button"
                    className={`nft-card ${picked?.token_id === x.token_id ? 'is-selected' : ''}`}
                    onClick={() => setPicked(x)}
                    style={{ padding: 0, textAlign: 'left' }}
                  >
                    <div className="nft-card__media"><TokenArt collection={col} token={x} /></div>
                    <div className="nft-card__body"><div className="nft-card__name">#{shortId(x.token_id)}</div></div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ItemPreview col={col} token={chosen} />
          )}
          <p className="small soft">{t('accept.body')}</p>
          <div className="sum-rows">
            <div><span className="muted">{t('common.price')}</span><span className="mono-num strong">{eth(order.price_wei)} WETH</span></div>
          </div>
          <SellerSummary priceWei={BigInt(order.price_wei)} col={col} unit="WETH" />
          <button className="btn btn--lg btn--block" disabled={!chosen} onClick={submit}>{t('accept.confirm')}</button>
        </>
      ) : (
        <RunnerStatus runner={runner} successText={t('accept.done')} onClose={onClose} />
      )}
    </Modal>
  );
}

function CancelModal({ runner, onClose, col, order }: ModalProps & { order: Order }) {
  const { t } = useI18n();
  const isListing = order.kind === 'listing';
  async function submit() {
    await runner.run((ctx) => cancelOrder(ctx, { order }));
  }
  const title: DictKey = isListing ? 'cancel.listingTitle' : 'cancel.offerTitle';
  return (
    <Modal open onClose={onClose} title={t(title)} locked={runner.busy} width={440}>
      {runner.phase === 'form' ? (
        <>
          <p className="soft">{t(isListing ? 'cancel.listingBody' : 'cancel.offerBody')}</p>
          <div className="modal-item">
            <span className="thumb" style={{ position: 'relative' }}><CollectionAvatar collection={col} /></span>
            <div style={{ flex: 1 }}>
              <div className="strong">{order.token_id ? `#${shortId(order.token_id)}` : t('col.collectionOffer')}</div>
              <div className="small muted">{col.name}</div>
            </div>
            <span className="strong mono-num">{eth(order.price_wei)} {isListing ? 'ETH' : 'WETH'}</span>
          </div>
          <div className="row">
            <button className="btn btn--outline" style={{ flex: 1 }} onClick={onClose}>{t('common.close')}</button>
            <button className="btn" style={{ flex: 1 }} onClick={submit}>{t('cancel.confirm')}</button>
          </div>
        </>
      ) : (
        <RunnerStatus runner={runner} successText={t('cancel.done')} onClose={onClose} />
      )}
    </Modal>
  );
}
