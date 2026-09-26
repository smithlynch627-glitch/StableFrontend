// Bulk actions on your own NFTs: list many with one signature, delist many in one transaction,
// send many in one transaction. Each popup explains exactly what the wallet will ask for.
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueries } from '@tanstack/react-query';
import { isAddress } from 'viem';
import { useAccount, useSignMessage } from 'wagmi';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { bulkDelist, bulkList, bulkTransfer, errorMessage, revokeNftApproval, type ActionCtx, type StepKey } from '../lib/actions';
import type { Address } from '../lib/types';
import { bpsFee, eth, short, tokenLabel, toWei } from '../lib/format';
import type { Collection, DropState, Token } from '../lib/types';
import { TokenArt } from './Art';
import { IconAlert, IconCheck } from './Icons';
import { RunnerStatus, useRunner } from './trade';
import { Modal } from './ui';

export type OwnedToken = Token & { collection_slug?: string; collection_name?: string };
const key = (t: OwnedToken) => `${t.collection.toLowerCase()}:${t.token_id}`;

function useCollections(tokens: OwnedToken[]) {
  const addrs = [...new Set(tokens.map((t) => t.collection.toLowerCase()))];
  const qs = useQueries({
    queries: addrs.map((a) => ({
      queryKey: ['collection', a],
      queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${a}`),
      staleTime: 30_000,
    })),
  });
  const map = new Map<string, Collection>();
  qs.forEach((q, i) => q.data && map.set(addrs[i], q.data.collection));
  return { map, loading: qs.some((q) => q.isLoading), count: addrs.length };
}

function Thumb({ t, c }: { t: OwnedToken; c?: Collection }) {
  return (
    <span className="thumb thumb--sm" style={{ position: 'relative' }}>
      <TokenArt collection={c ?? { address: t.collection, art_style: t.art_style || 'tile' }} token={t} />
    </span>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────
export function BulkListModal({ tokens, onClose }: { tokens: OwnedToken[]; onClose: () => void }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const runner = useRunner();
  const { address } = useAccount();
  const { map: cols, loading, count: colCount } = useCollections(tokens);
  const [all, setAll] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(tokens.map((x) => [key(x), x.listing_price_wei && x.listing_maker === address?.toLowerCase() ? eth(x.listing_price_wei, 6) : ''])),
  );
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<{ saved: number; failed: { tokenId: string; err: string }[] } | null>(null);
  const feeBps = cfg.marketFeeBps ?? 0;
  const rows = tokens.map((x) => {
    const c = cols.get(x.collection.toLowerCase());
    const wei = toWei(prices[key(x)] || '');
    const current = x.listing_price_wei && x.listing_maker === address?.toLowerCase() ? BigInt(x.listing_price_wei) : null;
    const royalty = c && wei ? bpsFee(wei, c.royalty_bps) : 0n;
    const below = !!wei && !!c?.floor_wei && wei < (BigInt(c.floor_wei) * 7n) / 10n;
    return { x, c, wei, current, royalty, receive: wei ? wei - bpsFee(wei, feeBps) - royalty : 0n, raising: !!current && !!wei && wei > current, below };
  });
  const ready = rows.every((r) => r.wei && r.wei > 0n) && !loading;
  const total = rows.reduce((s, r) => s + (r.wei ?? 0n), 0n);
  const receive = rows.reduce((s, r) => s + r.receive, 0n);
  const raising = rows.filter((r) => r.raising).length;
  const lowball = rows.filter((r) => r.below).length;
  const [confirmLow, setConfirmLow] = useState(false);

  async function submit() {
    const items = rows.map((r) => ({ collection: r.c!, tokenId: r.x.token_id, priceWei: r.wei! }));
    const plan: StepKey[] = [...(raising ? (['cancelOld'] as StepKey[]) : []), 'sign'];
    const out = await runner.run((ctx) => bulkList(ctx, { items, days }), plan);
    if (out && 'saved' in out) setResult({ saved: out.saved.length, failed: out.failed });
    else if (out) setResult({ saved: 1, failed: [] });
  }

  return (
    <Modal open onClose={onClose} title={t('bulk.listTitle', { n: tokens.length })} locked={runner.busy} width={640}>
      {runner.phase === 'form' ? (
        <div className="bulk">
          <div className="bulk__all">
            <div className="input-wrap" style={{ flex: 1 }}>
              <input className="input" inputMode="decimal" placeholder={t('bulk.samePrice')} value={all} onChange={(e) => setAll(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} />
              <span className="suffix">ETH</span>
            </div>
            <button type="button" className="btn btn--sm" disabled={!toWei(all)} onClick={() => setPrices(Object.fromEntries(tokens.map((x) => [key(x), all])))}>{t('bulk.applyAll')}</button>
            <button type="button" className="btn btn--sm btn--outline" onClick={() => setPrices((p) => Object.fromEntries(tokens.map((x) => {
              const f = cols.get(x.collection.toLowerCase())?.floor_wei;
              return [key(x), f ? eth(f, 6) : p[key(x)] || ''];
            })))}>{t('bulk.useFloors')}</button>
          </div>
          <div className="bulk__rows">
            {rows.map((r) => (
              <div className={`bulk__row ${r.below ? 'is-warn' : ''}`} key={key(r.x)}>
                <Thumb t={r.x} c={r.c} />
                <div style={{ minWidth: 0 }}>
                  <div className="strong small ellipsis">{tokenLabel(r.x.name, r.x.token_id)}</div>
                  <div className="tiny muted ellipsis">{r.c?.name || r.x.collection_name}{r.c?.floor_wei ? ` · ${t('bulk.floor', { price: eth(r.c.floor_wei) })}` : ''}{r.current ? ` · ${t('bulk.listedAt', { price: eth(r.current) })}` : ''}</div>
                </div>
                <div className="input-wrap bulk__price">
                  <input className="input" inputMode="decimal" placeholder="0.00" value={prices[key(r.x)] || ''} aria-label={t('list.price')}
                    onChange={(e) => setPrices((p) => ({ ...p, [key(r.x)]: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') }))} />
                  <span className="suffix">ETH</span>
                </div>
              </div>
            ))}
          </div>
          <div className="field">
            <span className="label">{t('list.duration')}</span>
            <div className="row-wrap">{[1, 3, 7, 30].map((d) => <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>{t('list.days', { n: d })}</button>)}</div>
          </div>
          <div className="sum-rows">
            <div><span className="muted">{t('bulk.total')}</span><span className="mono-num">{eth(total)} ETH</span></div>
            <div><span className="muted">{t('common.marketFee')} ({feeBps / 100}%) + {t('common.royalty')}</span><span className="mono-num">{eth(total - receive)} ETH</span></div>
            <div className="total"><span>{t('common.youReceive')}</span><span className="mono-num">{eth(receive)} ETH</span></div>
          </div>
          <div className="notice"><IconCheck size={16} /><span>{t('bulk.listHow', { n: tokens.length, c: colCount })}</span></div>
          {raising > 0 && <div className="notice notice--warn"><IconAlert size={16} /><span>{t('bulk.raiseNote', { n: raising })}</span></div>}
          {lowball > 0 && (
            <label className="notice notice--warn" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmLow} onChange={(e) => setConfirmLow(e.target.checked)} />
              <span>{t('bulk.lowWarn', { n: lowball })}</span>
            </label>
          )}
          <button className="btn btn--lg btn--block" disabled={!ready || (lowball > 0 && !confirmLow)} onClick={submit}>{t('bulk.listBtn', { n: tokens.length })}</button>
        </div>
      ) : (
        <RunnerStatus runner={runner} onClose={onClose}
          successText={result && result.failed.length ? t('bulk.listPartial', { n: result.saved, f: result.failed.length }) : t('bulk.listDone', { n: result?.saved ?? tokens.length })}
          extra={result?.failed.length ? <div className="small soft">{result.failed.map((f) => `#${f.tokenId}: ${f.err}`).join(' · ')}</div> : undefined} />
      )}
    </Modal>
  );
}

// ── Delist ───────────────────────────────────────────────────────────────────
export function BulkDelistModal({ tokens, onClose }: { tokens: OwnedToken[]; onClose: () => void }) {
  const { t } = useI18n();
  const runner = useRunner();
  const { address } = useAccount();
  const listed = tokens.filter((x) => x.listing_hash && x.listing_maker === address?.toLowerCase());
  const [done, setDone] = useState(0);
  async function submit() {
    const out = await runner.run((ctx) => bulkDelist(ctx, listed.map((x) => ({ collection: x.collection, tokenId: x.token_id }))));
    if (out) setDone(out.cancelled);
  }
  return (
    <Modal open onClose={onClose} title={t('bulk.delistTitle', { n: listed.length })} locked={runner.busy}>
      {runner.phase === 'form' ? (
        <div className="bulk">
          <div className="bulk__rows bulk__rows--compact">
            {listed.map((x) => (
              <div className="bulk__row" key={key(x)}>
                <Thumb t={x} />
                <div style={{ minWidth: 0 }}><div className="strong small ellipsis">{tokenLabel(x.name, x.token_id)}</div><div className="tiny muted ellipsis">{x.collection_name}</div></div>
                <span className="mono-num strong small">{eth(x.listing_price_wei)} ETH</span>
              </div>
            ))}
          </div>
          {tokens.length > listed.length && <div className="small muted">{t('bulk.notListed', { n: tokens.length - listed.length })}</div>}
          <div className="notice"><IconCheck size={16} /><span>{t('bulk.delistHow', { n: listed.length })}</span></div>
          <button className="btn btn--lg btn--block" disabled={!listed.length} onClick={submit}>{t('bulk.delistBtn', { n: listed.length })}</button>
        </div>
      ) : (
        <RunnerStatus runner={runner} successText={t('bulk.delistDone', { n: done || listed.length })} onClose={onClose} />
      )}
    </Modal>
  );
}

// ── Send ─────────────────────────────────────────────────────────────────────
export function BulkSendModal({ tokens, onClose }: { tokens: OwnedToken[]; onClose: () => void }) {
  const { t } = useI18n();
  const runner = useRunner();
  const { address } = useAccount();
  const [to, setTo] = useState('');
  const [sure, setSure] = useState(false);
  const target = to.trim();
  const valid = isAddress(target);
  const self = valid && target.toLowerCase() === address?.toLowerCase();
  const cols = useMemo(() => new Set(tokens.map((x) => x.collection.toLowerCase())).size, [tokens]);
  const listedCount = tokens.filter((x) => x.listing_hash).length;
  async function submit() {
    await runner.run((ctx) => bulkTransfer(ctx, { items: tokens.map((x) => ({ collection: x.collection, tokenId: x.token_id })), to: target }), ['transfer']);
  }
  return (
    <Modal open onClose={onClose} title={t('bulk.sendTitle', { n: tokens.length })} locked={runner.busy}>
      {runner.phase === 'form' ? (
        <div className="bulk">
          <div className="bulk__thumbs">
            {tokens.slice(0, 12).map((x) => <Thumb key={key(x)} t={x} />)}
            {tokens.length > 12 && <span className="thumb thumb--sm bulk__more">+{tokens.length - 12}</span>}
          </div>
          <div className="field">
            <label htmlFor="send-to">{t('bulk.to')}</label>
            <input id="send-to" className="input mono-num" placeholder="0x…" value={to} onChange={(e) => { setTo(e.target.value); setSure(false); }} autoComplete="off" spellCheck={false} />
            {target && !valid && <span className="hint" style={{ color: 'var(--bad)' }}>{t('bulk.badAddress')}</span>}
            {self && <span className="hint" style={{ color: 'var(--bad)' }}>{t('bulk.selfAddress')}</span>}
            {valid && !self && <span className="hint">{t('bulk.toCheck', { a: `${target.slice(0, 8)}…${target.slice(-6)}` })}</span>}
          </div>
          <div className="notice"><IconCheck size={16} /><span>{tokens.length === 1 ? t('bulk.sendHowOne') : t('bulk.sendHow', { n: tokens.length, c: cols })}</span></div>
          {listedCount > 0 && <div className="notice notice--warn"><IconAlert size={16} /><span>{t('bulk.sendListed', { n: listedCount })}</span></div>}
          <label className="row small" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={!valid || self} />
            <span>{t('bulk.sendSure', { n: tokens.length, a: valid ? short(target) : '…' })}</span>
          </label>
          <button className="btn btn--lg btn--block" disabled={!valid || self || !sure} onClick={submit}>{t('bulk.sendBtn', { n: tokens.length })}</button>
        </div>
      ) : (
        <RunnerStatus
          runner={runner}
          successText={t('bulk.sendDone', { n: tokens.length, a: short(target) })}
          onClose={onClose}
          extra={tokens.length > 1 ? <RevokeAfterSend collections={[...new Set(tokens.map((x) => x.collection.toLowerCase()))]} /> : null}
        />
      )}
    </Modal>
  );
}

/**
 * After a batch send the marketplace keeps its permission to move NFTs of these collections (it was needed for the
 * send). Offer to remove it right away for anyone who doesn't plan to list items from them.
 */
function RevokeAfterSend({ collections }: { collections: string[] }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<{ busy: boolean; done: number; error: string | null }>({ busy: false, done: 0, error: null });
  if (!cfg.market || !address) return null;
  async function revoke() {
    const ctx: ActionCtx = { cfg, address: address as Address, signMessage: (message) => signMessageAsync({ message }), progress: () => {} };
    setState({ busy: true, done: 0, error: null });
    let done = 0;
    try {
      for (const c of collections) {
        await revokeNftApproval(ctx, c, cfg.market!);
        done += 1;
        setState({ busy: true, done, error: null });
      }
      setState({ busy: false, done, error: null });
    } catch (e) {
      setState({ busy: false, done, error: errorMessage(e, t) });
    }
  }
  const finished = state.done === collections.length;
  return (
    <div className="notice" style={{ textAlign: 'left', display: 'grid', gap: 8 }}>
      <span className="small">{finished ? t('bulk.revokeDone') : t('bulk.revokeAsk', { n: collections.length })}</span>
      {state.error && <span className="small" style={{ color: 'var(--bad)' }}>{state.error}</span>}
      {!finished && (
        <button className="btn btn--outline btn--sm" disabled={state.busy} onClick={revoke}>
          {state.busy ? t('bulk.revoking', { n: state.done, c: collections.length }) : t('bulk.revokeBtn')}
        </button>
      )}
    </div>
  );
}

// ── Selection + action bar (profile and collection pages) ───────────────────
export const MAX_SELECT = 100;

/** Which of your items are picked. Keys are collection:tokenId, so items from many collections can mix. */
export function useBulkSelection() {
  const [managing, setManaging] = useState(false);
  const [sel, setSel] = useState<Map<string, OwnedToken>>(new Map());
  const toggle = useCallback((x: OwnedToken) => setSel((m) => {
    const n = new Map(m);
    if (n.has(key(x))) n.delete(key(x));
    else if (n.size < MAX_SELECT) n.set(key(x), x);
    return n;
  }), []);
  return {
    managing,
    start: () => setManaging(true),
    stop: () => { setManaging(false); setSel(new Map()); },
    has: (x: OwnedToken) => sel.has(key(x)),
    toggle,
    selectMany: (list: OwnedToken[]) => setSel(new Map(list.slice(0, MAX_SELECT).map((x) => [key(x), x]))),
    clear: () => setSel(new Map()),
    chosen: [...sel.values()],
    size: sel.size,
  };
}
export type BulkSelection = ReturnType<typeof useBulkSelection>;

/** Floating bar with List / Delist / Send for the picked items, and their popups. */
export function BulkBar({ bulk }: { bulk: BulkSelection }) {
  const { t } = useI18n();
  const { address } = useAccount();
  const [modal, setModal] = useState<'list' | 'delist' | 'send' | null>(null);
  const chosen = bulk.chosen;
  const listedMine = chosen.filter((x) => x.listing_hash && x.listing_maker === address?.toLowerCase()).length;
  const canTrade = chosen.every((x) => x.tradable !== false);
  const done = () => { setModal(null); bulk.stop(); };
  return (
    <>
      {bulk.managing && createPortal(
        <div className="sweep-bar bulk-bar" role="region" aria-label={t('bulk.select')}>
          <div style={{ display: 'grid', gap: 2, minWidth: 100 }}>
            <span className="strong">{t('col.selected', { n: bulk.size })}</span>
            <button className="tiny bulk-bar__clear" onClick={bulk.clear} disabled={!bulk.size}>{t('col.clearSel')}</button>
          </div>
          <div className="sweep-bar__actions">
            <button className="btn" disabled={!bulk.size || bulk.size > 50 || !canTrade} onClick={() => setModal('list')} title={bulk.size > 50 ? t('bulk.max50') : undefined}>{t('bulk.list', { n: bulk.size })}</button>
            <button className="btn" disabled={!listedMine} onClick={() => setModal('delist')}>{t('bulk.delist', { n: listedMine })}</button>
            <button className="btn" disabled={!bulk.size} onClick={() => setModal('send')}>{t('bulk.send', { n: bulk.size })}</button>
          </div>
        </div>,
        document.body,
      )}
      {modal === 'list' && <BulkListModal tokens={chosen} onClose={done} />}
      {modal === 'delist' && <BulkDelistModal tokens={chosen} onClose={done} />}
      {modal === 'send' && <BulkSendModal tokens={chosen} onClose={done} />}
    </>
  );
}
