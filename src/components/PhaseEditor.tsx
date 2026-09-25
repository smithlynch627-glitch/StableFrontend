// Shared mint-phase editor (Create wizard + Studio).
// Rules that match the v2 contract: 1–5 phases, start times in order, and the last phase is always
// "Public" — open to every wallet, not removable, not renamable. New phases are inserted above Public.
import { useMemo } from 'react';
import { zeroHash } from 'viem';
import { useI18n, type T } from '../i18n';
import { countdown, eth, toWei } from '../lib/format';
import type { PhaseChange } from '../lib/types';
import { readAddressFile } from './IpfsUpload';
import { IconLock, IconPlus, IconTrash } from './Icons';

export const MAX_PHASES = 5;
const ADDR = /0x[0-9a-fA-F]{40}/g;

export type PhaseDraft = {
  key: string;
  /** v2 phase id this draft continues (0 = a brand-new phase). */
  id: number;
  /** Position of the phase on-chain when the editor opened (null = new). */
  origin: number | null;
  name: string;
  start: string;
  end: string;
  price: string;
  max: string;
  mode: 'none' | 'keep' | 'new';
  list: string;
  /** The allowlist root currently on-chain (for "keep"). */
  root: `0x${string}`;
  isPublic: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const secToInput = (sec: bigint | number) => (Number(sec) ? localInput(new Date(Number(sec) * 1000)) : '');
export const inputToSec = (v: string) => (v ? BigInt(Math.floor(new Date(v).getTime() / 1000)) : 0n);
const ms = (v: string) => (v ? new Date(v).getTime() : NaN);
let seq = 0;
const nextKey = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

export const addressesIn = (text: string) => [...new Set((text.match(ADDR) || []).map((a) => a.toLowerCase()))];

export function draft(p: Partial<PhaseDraft>): PhaseDraft {
  return { key: nextKey(), id: 0, origin: null, name: '', start: '', end: '', price: '0', max: '', mode: 'none', list: '', root: zeroHash, isPublic: false, ...p };
}

/** Default phases for a new collection: an allowlist phase, then Public. */
export function defaultDrafts(): PhaseDraft[] {
  const a = new Date(Date.now() + 3600e3);
  const b = new Date(a.getTime() + 86400e3);
  return [
    draft({ name: 'Allowlist', start: localInput(a), end: localInput(b), price: '0.0002', max: '2', mode: 'new' }),
    draft({ name: 'Public', start: localInput(b), end: localInput(new Date(b.getTime() + 7 * 86400e3)), price: '0.0002', max: '10', isPublic: true }),
  ];
}

/** Adds a phase directly above Public; Public moves later if the new phase would overlap it. */
export function insertAbovePublic(ds: PhaseDraft[]): PhaseDraft[] {
  const pub = ds[ds.length - 1];
  const prev = ds.length > 1 ? ds[ds.length - 2] : null;
  const floor = Date.now() + 10 * 60e3;
  const prevEnd = prev ? (prev.end ? ms(prev.end) : ms(prev.start) + 86400e3) : ms(pub.start) - 86400e3;
  const start = Math.max(Number.isFinite(prevEnd) ? prevEnd : floor, floor);
  const end = start + 86400e3;
  const taken = new Set(ds.map((d) => d.name.toLowerCase()));
  const name = !taken.has('allowlist') ? 'Allowlist' : `Phase ${ds.length}`;
  const added = draft({ name, start: localInput(new Date(start)), end: localInput(new Date(end)), price: pub.price, max: '2', mode: 'new' });
  let nextPub = pub;
  if (!Number.isFinite(ms(pub.start)) || ms(pub.start) < end) {
    const dur = pub.end && Number.isFinite(ms(pub.end) - ms(pub.start)) ? ms(pub.end) - ms(pub.start) : 0;
    nextPub = { ...pub, start: localInput(new Date(end)), end: dur > 0 ? localInput(new Date(end + dur)) : pub.end };
  }
  return [...ds.slice(0, -1), added, nextPub];
}

/** Returns the first problem as a readable message, or null when the phases are valid. */
export function validateDrafts(ds: PhaseDraft[], t: T, opts: { requirePublic?: boolean } = {}): string | null {
  const strict = opts.requirePublic ?? true; // v1 contracts (legacy editing) do not enforce order or a Public phase
  if (!ds.length || ds.length > MAX_PHASES) return t('phase.max');
  for (const [i, p] of ds.entries()) {
    const n = i + 1;
    if (!p.isPublic && !p.name.trim()) return t('phase.errName', { n });
    if (!p.isPublic && /^public$/i.test(p.name.trim())) return t('phase.errPublicName', { n });
    const start = ms(p.start);
    const end = p.end ? ms(p.end) : Infinity;
    if (!Number.isFinite(start) || !(end > start) || toWei(p.price || '0') === null) return t('create.errPhase', { n });
    if (!/^\d*$/.test(p.max)) return t('create.errPhase', { n });
    if (p.mode === 'new' && !addressesIn(p.list).length) return t('create.errAllowlist', { n });
    if (strict && i > 0 && start < ms(ds[i - 1].start)) return t('phase.errOrder', { n, prev: i });
  }
  if (strict && (!ds[ds.length - 1].isPublic || ds[ds.length - 1].mode !== 'none')) return t('err.PublicPhaseRequired');
  return null;
}

/** On-chain struct for a draft (merkle root supplied by the caller for new lists). */
export function toChainPhase(p: PhaseDraft, root: `0x${string}`) {
  return {
    startTime: inputToSec(p.start),
    endTime: inputToSec(p.end),
    price: toWei(p.price || '0') ?? 0n,
    maxPerWallet: Number(p.max || 0),
    merkleRoot: p.mode === 'none' ? zeroHash : root,
  };
}

// ── Diff (same shape the indexer records for the public "configuration changed" notice) ─────────
type Snap = { name: string; start: string; end: string | null; priceWei: string; maxPerWallet: number | null; gated: boolean; fresh: boolean };
const snap = (p: PhaseDraft): Snap => ({
  name: p.isPublic ? 'Public' : p.name.trim(),
  start: Number.isFinite(ms(p.start)) ? new Date(ms(p.start)).toISOString() : '',
  end: p.end && Number.isFinite(ms(p.end)) ? new Date(ms(p.end)).toISOString() : null,
  priceWei: String(toWei(p.price || '0') ?? 0n),
  maxPerWallet: Number(p.max || 0) || null,
  gated: p.mode !== 'none',
  fresh: p.mode === 'new',
});

export function diffDrafts(before: PhaseDraft[], after: PhaseDraft[]): PhaseChange[] {
  const out: PhaseChange[] = [];
  const used = new Set<string>();
  for (const a of after) {
    const b = before.find((x) => x.key === a.key);
    const sa = snap(a);
    if (!b) {
      out.push({ type: 'added', phase: sa.name, after: { start: sa.start, end: sa.end, priceWei: sa.priceWei, maxPerWallet: sa.maxPerWallet, allowlist: sa.gated } });
      continue;
    }
    used.add(b.key);
    const sb = snap(b);
    const field = (f: NonNullable<PhaseChange['field']>, from: PhaseChange['from'], to: PhaseChange['to']) => out.push({ type: 'changed', phase: sa.name || sb.name, field: f, from, to });
    if (sb.name !== sa.name) out.push({ type: 'changed', phase: sb.name, field: 'name', from: sb.name, to: sa.name });
    if (sb.priceWei !== sa.priceWei) field('price', sb.priceWei, sa.priceWei);
    if (sb.start !== sa.start) field('start', sb.start, sa.start);
    if (sb.end !== sa.end) field('end', sb.end, sa.end);
    if (sb.maxPerWallet !== sa.maxPerWallet) field('maxPerWallet', sb.maxPerWallet, sa.maxPerWallet);
    if (sb.gated !== sa.gated || sa.fresh) field('allowlist', sb.gated ? 'allowlist' : 'open', sa.gated ? (sb.gated ? 'updated' : 'allowlist') : 'open');
  }
  for (const b of before) if (!used.has(b.key)) out.push({ type: 'removed', phase: snap(b).name });
  return out;
}

// ── Editor UI ─────────────────────────────────────────────────────────────────
export function PhaseListEditor({
  value, onChange, allowKeep = false, locked = false, now = Date.now(),
}: {
  value: PhaseDraft[];
  onChange: (next: PhaseDraft[]) => void;
  /** Studio: phases that already have an on-chain list can keep it. */
  allowKeep?: boolean;
  /** v1 contracts: no adding or removing phases. */
  locked?: boolean;
  now?: number;
}) {
  const { t } = useI18n();
  const patch = (key: string, p: Partial<PhaseDraft>) => onChange(value.map((d) => (d.key === key ? { ...d, ...p } : d)));
  return (
    <div className="phase-stack">
      {value.map((p, i) => (
        <PhaseCard
          key={p.key}
          p={p}
          n={i + 1}
          allowKeep={allowKeep && p.root !== zeroHash}
          onPatch={(x) => patch(p.key, x)}
          onRemove={!locked && !p.isPublic && value.length > 1 ? () => onChange(value.filter((d) => d.key !== p.key)) : undefined}
          status={statusOf(p, now)}
        />
      ))}
      {!locked && (
        <div className="phase-stack__add">
          <button type="button" className="btn btn--outline" disabled={value.length >= MAX_PHASES} onClick={() => onChange(insertAbovePublic(value))}>
            <IconPlus size={16} />{t('phase.addAbove')}
          </button>
          <span className="tiny muted">{t('phase.max')}</span>
        </div>
      )}
    </div>
  );
}

function statusOf(p: PhaseDraft, now: number): 'live' | 'ended' | 'upcoming' | null {
  if (p.origin === null) return null;
  const s = ms(p.start);
  const e = p.end ? ms(p.end) : Infinity;
  if (!Number.isFinite(s)) return null;
  return now < s ? 'upcoming' : now < e ? 'live' : 'ended';
}

function PhaseCard({
  p, n, allowKeep, onPatch, onRemove, status,
}: {
  p: PhaseDraft; n: number; allowKeep: boolean; onPatch: (x: Partial<PhaseDraft>) => void; onRemove?: () => void; status: 'live' | 'ended' | 'upcoming' | null;
}) {
  const { t, lang } = useI18n();
  const count = useMemo(() => addressesIn(p.list).length, [p.list]);
  const start = ms(p.start);
  const end = p.end ? ms(p.end) : NaN;
  const duration = Number.isFinite(start) && Number.isFinite(end) && end > start ? countdown(end - start, lang) : null;
  const price = toWei(p.price || '0');
  return (
    <section className={`phase-card ${p.isPublic ? 'is-public' : ''} ${status === 'live' ? 'is-live' : ''}`}>
      <div className="phase-card__rail" aria-hidden><span className="phase-card__num">{p.isPublic ? <IconLock size={14} /> : n}</span></div>
      <div className="phase-card__body">
        <header className="phase-card__head">
          <div className="phase-card__title">
            {p.isPublic ? (
              <><span className="strong">{t('phase.public')}</span><span className="pill pill--outline phase-card__lock"><IconLock size={12} />{t('phase.publicLocked')}</span></>
            ) : (
              <input className="phase-card__name" maxLength={32} value={p.name} placeholder={t('create.phaseName')} aria-label={t('create.phaseName')} onChange={(e) => onPatch({ name: e.target.value })} />
            )}
            {status === 'live' && <span className="pill pill--live">{t('lp.live')}</span>}
            {status === 'ended' && <span className="pill">{t('lp.ended')}</span>}
            {p.origin === null && !p.isPublic && <span className="pill pill--solid">{t('phase.new')}</span>}
          </div>
          {onRemove && (
            <button type="button" className="icon-btn phase-card__remove" onClick={onRemove} aria-label={t('phase.remove')} title={t('phase.remove')}><IconTrash size={16} /></button>
          )}
        </header>

        <div className="phase-card__grid">
          <label className="field"><span className="label">{t('create.priceEth')}</span>
            <span className="input-wrap"><input className="input" inputMode="decimal" value={p.price} onChange={(e) => onPatch({ price: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} /><span className="suffix">ETH</span></span>
          </label>
          <label className="field"><span className="label">{t('create.maxPerWallet')}</span>
            <input className="input" inputMode="numeric" value={p.max} placeholder={t('phase.limitPh')} onChange={(e) => onPatch({ max: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field"><span className="label">{t('create.start')}</span>
            <input className="input" type="datetime-local" value={p.start} onChange={(e) => onPatch({ start: e.target.value })} />
          </label>
          <label className="field"><span className="label">{t('create.end')}</span>
            <input className="input" type="datetime-local" value={p.end} onChange={(e) => onPatch({ end: e.target.value })} />
          </label>
        </div>
        <div className="phase-card__meta tiny muted">
          <span>{price === 0n ? t('lp.free') : price ? `${eth(price, 6)} ETH` : '—'}</span>
          <span>{Number(p.max) ? t('drop.limit', { n: Number(p.max) }) : t('drop.noLimit')}</span>
          <span>{duration ? t('phase.duration', { time: duration }) : t('phase.untilSoldOut')}</span>
        </div>

        {p.isPublic ? (
          <div className="phase-card__open"><span className="dot dot--good" />{t('phase.publicHint')}</div>
        ) : (
          <div className="phase-card__access">
            <span className="label">{t('phase.access')}</span>
            <div className="segmented" role="group" aria-label={t('phase.access')}>
              {allowKeep && <button type="button" aria-pressed={p.mode === 'keep'} onClick={() => onPatch({ mode: 'keep' })}>{t('phase.keep')}</button>}
              <button type="button" aria-pressed={p.mode === 'new'} onClick={() => onPatch({ mode: 'new' })}>{allowKeep ? t('phase.newList') : t('phase.allowlist')}</button>
              <button type="button" aria-pressed={p.mode === 'none'} onClick={() => onPatch({ mode: 'none' })}>{t('phase.open')}</button>
            </div>
            {p.mode === 'new' && (
              <div className="field phase-card__list">
                <textarea className="textarea" value={p.list} onChange={(e) => onPatch({ list: e.target.value })} placeholder={'0x1234…\n0xabcd…'} spellCheck={false} />
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span className={`hint ${count ? 'hint--good' : ''}`}>{t('create.allowlistCount', { n: count })}</span>
                  <label className="btn btn--sm btn--outline" style={{ cursor: 'pointer' }}>
                    {t('art.csv')}
                    <input type="file" hidden accept=".csv,.txt,text/csv,text/plain" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) onPatch({ list: (await readAddressFile(file)).join('\n') });
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
