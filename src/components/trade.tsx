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
  acceptOffer, buyListings, cancelOrder, errorMessage, listItem, makeOffer, quote, relistHigher, stepLabel, wrapEth,
  type ActionCtx, type StepKey,
} from '../lib/actions';
import { collectionAbi, marketAbi, wethAbi } from '../lib/abis';
import { PINNED, activeChain } from '../config';
import { bpsFee, eth, shortId, tokenLabel, toWei } from '../lib/format';
import type { Address, Collection, DropState, Order, Token } from '../lib/types';
import { CollectionAvatar, TokenArt } from './Art';
import { IconAlert, IconCheck, IconClose } from './Icons';
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

type RunStep = { key: StepKey; done: boolean; pending?: boolean };

/**
 * Next step in the list. Steps planned up front (pending) stay visible and light up in turn; unplanned sub-steps
 * (wallet confirm, waiting, saving) are slotted in before the next planned one.
 */
function advance(s: RunStep[], key: StepKey): RunStep[] {
  const started = s.filter((x) => !x.pending).length - 1;
  const later = s.findIndex((x, i) => i > started && x.pending && x.key === key);
  if (later !== -1) return s.map((x, i) => (i < later ? { ...x, done: true, pending: false } : i === later ? { key, done: false } : x));
  const firstPending = s.findIndex((x) => x.pending);
  const at = firstPending === -1 ? s.length : firstPending;
  const done = s.map((x, i) => (i < at ? { ...x, done: true } : x));
  return [...done.slice(0, at), { key, done: false }, ...done.slice(at)];
}

export function useRunner() {
  const cfg = useAppConfig();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('form');
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [error, setError] = useState('');

  const run = useCallback(
    async <R,>(fn: (ctx: ActionCtx) => Promise<R>, plan: StepKey[] = []): Promise<R | undefined> => {
      if (!address) return;
      setPhase('running');
      setSteps(plan.map((key) => ({ key, done: false, pending: true })));
      setError('');
      const ctx: ActionCtx = {
        cfg,
        address: address as Address,
        signMessage: (message) => signMessageAsync({ message }),
        progress: (key) => setSteps((s) => advance(s, key)),
      };
      try {
        const out = await fn(ctx);
        setSteps((s) => s.map((x) => ({ key: x.key, done: true })));
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

export function StepList({ steps, failed = false }: { steps: RunStep[]; failed?: boolean }) {
  const { t } = useI18n();
  const lastStarted = steps.filter((x) => !x.pending).length - 1;
  return (
    <ol className="steps">
      {steps.map((s, i) => {
        const state = s.pending ? 'is-pending' : s.done ? 'is-done' : failed && i === lastStarted ? 'is-failed' : 'is-active';
        return (
          <li key={`${s.key}-${i}`} className={state}>
            <span className="step-dot">
              {state === 'is-done' ? <IconCheck size={13} /> : state === 'is-active' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : state === 'is-failed' ? <IconClose size={12} /> : <span className="step-dot__n">{i + 1}</span>}
            </span>
            {t(stepLabel[s.key])}
          </li>
        );
      })}
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
        {runner.steps.some((s) => !s.pending) && <StepList steps={runner.steps.map((s) => (s.done ? s : { ...s, done: false }))} failed />}
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
  // Fee and royalty straight from the contracts (the same values the signed order will cap), not from the server.
  const market = (PINNED.market || cfg.market) as Address | null;
  const onchainFee = useReadContract({ address: market ?? undefined, abi: marketAbi, functionName: 'marketFeeBps', chainId: activeChain.id, query: { enabled: !!market, staleTime: 60_000 } });
  const onchainRoyalty = useReadContract({ address: col.address as Address, abi: collectionAbi, functionName: 'royaltyInfo', args: [1n, 10_000n], chainId: activeChain.id, query: { staleTime: 60_000 } });
  const feeBps = onchainFee.data !== undefined ? Number(onchainFee.data) : (cfg.marketFeeBps ?? 0);
  const royaltyBps = onchainRoyalty.data ? Number((onchainRoyalty.data as readonly [Address, bigint])[1]) : col.royalty_bps;
  const fee = bpsFee(p, feeBps);
  const royalty = bpsFee(p, royaltyBps);
  return (
    <div className="sum-rows">
      <div><span className="muted">{t('common.marketFee')} ({feeBps / 100}%)</span><span className="mono-num">{eth(fee)} {unit}</span></div>
      <div><span className="muted">{t('common.royalty')} ({royaltyBps / 100}%)</span><span className="mono-num">{eth(royalty)} {unit}</span></div>
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
  const { address } = useAccount();
  const current = token.listing_price_wei && token.listing_maker === address?.toLowerCase() ? BigInt(token.listing_price_wei) : null;
  const [price, setPrice] = useState(current ? eth(current, 6) : '');
  const [days, setDays] = useState(7);
  const wei = toWei(price);
  const valid = !!wei && wei > 0n;
  // Raising needs the current (cheaper) listing cancelled on-chain first; lowering just signs a new one.
  const raising = !!current && !!wei && wei > current;
  const lowering = !!current && !!wei && wei < current;
  const same = !!current && !!wei && wei === current;
  const below = !!wei && !!col.floor_wei && wei < BigInt(col.floor_wei);
  const priceText = wei ? eth(wei, 6) : '0';

  async function submit() {
    if (!wei) return;
    const a = { collection: col, tokenId: token.token_id, priceWei: wei, days };
    if (raising) await runner.run((ctx) => relistHigher(ctx, a), ['cancelOld', 'sign']);
    else await runner.run((ctx) => listItem(ctx, a));
  }

  return (
    <Modal open onClose={onClose} title={current ? t('list.editTitle') : t('list.title')} locked={runner.busy}>
      {runner.phase === 'form' ? (
        <>
          <ItemPreview col={col} token={token} />
          {current && (
            <div className="list-current">
              <span className="small muted">{t('list.currentPrice')}</span>
              <span className="strong mono-num">{eth(current, 6)} ETH</span>
            </div>
          )}
          <PriceInput label={current ? t('list.newPrice') : t('list.price')} value={price} onChange={setPrice} unit="ETH" />
          {col.floor_wei && (
            <div className="row" style={{ justifyContent: 'space-between', marginTop: -8 }}>
              <span className="small muted">{t('list.floor', { price: eth(col.floor_wei) })}</span>
              <button className="chip" type="button" onClick={() => setPrice(eth(col.floor_wei, 6))}>{t('list.useFloor')}</button>
            </div>
          )}
          {below && <div className="notice"><IconAlert size={16} />{t('list.belowFloor')}</div>}
          {raising && (
            <div className="relist-plan">
              <div className="relist-plan__title"><IconAlert size={16} />{t('list.raiseTitle')}</div>
              <ol>
                <li><span className="relist-plan__n">1</span><span><strong>{t('list.raiseStep1', { price: eth(current!, 6) })}</strong><span className="tiny muted">{t('list.raiseStep1Sub')}</span></span></li>
                <li><span className="relist-plan__n">2</span><span><strong>{t('list.raiseStep2', { price: priceText })}</strong><span className="tiny muted">{t('list.raiseStep2Sub')}</span></span></li>
              </ol>
            </div>
          )}
          {lowering && <div className="notice"><IconCheck size={16} />{t('list.lowerHint')}</div>}
          <DurationPicker value={days} onChange={setDays} />
          <SellerSummary priceWei={wei} col={col} unit="ETH" />
          <button className="btn btn--lg btn--block" disabled={!valid || same} onClick={submit}>
            {raising ? t('list.confirmRaise', { price: priceText }) : current ? t('list.confirmUpdate') : t('list.confirm')}
          </button>
        </>
      ) : (
        <RunnerStatus runner={runner} successText={raising || runner.steps.some((s) => s.key === 'cancelOld') ? t('list.doneRaise', { price: priceText }) : t('list.done')} onClose={onClose} />
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
    const out = await runner.run((ctx) => buyListings(ctx, items.map((x) => ({
      hash: x.listing_hash!, collection: col.address, tokenId: x.token_id, priceWei: BigInt(x.listing_price_wei || 0),
    }))));
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
      return acceptOffer(ctx, { order, collection: col.address, tokenId: chosen.token_id, minProceeds: q.proceeds });
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
