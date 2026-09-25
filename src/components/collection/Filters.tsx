// Market filters: status, price, rarity rank, owner and traits. The URL holds the applied filters,
// so a filtered view can be shared and trait links from item pages open with the trait already selected.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/en';
import { num } from '../../lib/format';
import { rarityTone, toneVars } from '../../lib/rarity';
import type { TraitsResponse } from '../../lib/types';
import { IconChevron, IconClose, IconSearch } from '../Icons';
import { TraitShare } from '../Rarity';

export type Status = 'all' | 'listed' | 'unlisted' | 'offers';
/** Filter value for "has no <trait type>" (matches the API). */
export const NO_TRAIT = '__none__';
export const STATUSES: [Status, DictKey][] = [['all', 'col.all'], ['listed', 'col.buyNow'], ['unlisted', 'col.notListedF'], ['offers', 'col.hasOffers']];
export const SORTS: [string, DictKey][] = [
  ['price_asc', 'col.sortPriceAsc'], ['price_desc', 'col.sortPriceDesc'], ['recent', 'col.sortRecent'],
  ['rarity', 'col.sortRarity'], ['rarity_desc', 'col.sortRarityDesc'], ['offer_desc', 'col.sortOffer'],
  ['last_sale_desc', 'col.sortLastSaleDesc'], ['last_sale_asc', 'col.sortLastSaleAsc'],
  ['id_asc', 'col.sortId'], ['id_desc', 'col.sortIdDesc'],
];

export interface MarketFilters {
  status: Status;
  sort: string;
  min: string;
  max: string;
  rmin: string;
  rmax: string;
  mine: boolean;
  traits: Record<string, string[]>;
  q: string;
}

const readTraits = (raw: string | null): Record<string, string[]> => {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, string[]> = {};
    for (const [k, vals] of Object.entries(v)) if (Array.isArray(vals) && vals.length) out[k] = vals.map(String);
    return out;
  } catch {
    return {};
  }
};

/** Filters read from and written to the URL (?status=listed&min=0.1&traits={...}). */
export function useMarketFilters() {
  const [params, setParams] = useSearchParams();
  const f: MarketFilters = {
    status: (STATUSES.some(([s]) => s === params.get('status')) ? params.get('status') : 'all') as Status,
    sort: SORTS.some(([s]) => s === params.get('sort')) ? params.get('sort')! : 'price_asc',
    min: params.get('min') || '',
    max: params.get('max') || '',
    rmin: params.get('rmin') || '',
    rmax: params.get('rmax') || '',
    mine: params.get('mine') === '1',
    traits: readTraits(params.get('traits')),
    q: params.get('q') || '',
  };
  const set = (patch: Partial<MarketFilters>) => {
    const next = { ...f, ...patch };
    const p = new URLSearchParams(params);
    const put = (k: string, v: string, empty = '') => (v && v !== empty ? p.set(k, v) : p.delete(k));
    put('status', next.status, 'all');
    put('sort', next.sort, 'price_asc');
    put('min', next.min);
    put('max', next.max);
    put('rmin', next.rmin);
    put('rmax', next.rmax);
    put('mine', next.mine ? '1' : '');
    put('traits', Object.keys(next.traits).length ? JSON.stringify(next.traits) : '');
    put('q', next.q.trim());
    setParams(p, { replace: true });
  };
  const clear = () => set({ status: 'all', min: '', max: '', rmin: '', rmax: '', mine: false, traits: {}, q: '' });
  const activeCount =
    (f.status !== 'all' ? 1 : 0) + (f.min || f.max ? 1 : 0) + (f.rmin || f.rmax ? 1 : 0) + (f.mine ? 1 : 0) + Object.values(f.traits).flat().length;
  return { f, set, clear, activeCount };
}

function Section({ title, badge, defaultOpen = true, forceOpen = false, children }: { title: ReactNode; badge?: number; defaultOpen?: boolean; forceOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  // Searching traits opens every group that has a match.
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  return (
    <section className={`fx-section ${open ? 'is-open' : ''}`}>
      <button type="button" className="fx-section__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="fx-section__title">{title}</span>
        {!!badge && <span className="fx-badge">{badge}</span>}
        <IconChevron size={16} className="fx-chev" />
      </button>
      {open && <div className="fx-section__body">{children}</div>}
    </section>
  );
}

/** Two number boxes with Apply (also on Enter). */
function RangeInputs({ min, max, onApply, unit, placeholders, integer = false }: {
  min: string; max: string; onApply: (min: string, max: string) => void; unit?: string; placeholders: [string, string]; integer?: boolean;
}) {
  const { t } = useI18n();
  const [a, setA] = useState(min);
  const [b, setB] = useState(max);
  useEffect(() => { setA(min); setB(max); }, [min, max]);
  const clean = (v: string) => (integer ? v.replace(/[^0-9]/g, '') : v.replace(',', '.').replace(/[^0-9.]/g, ''));
  const dirty = a !== min || b !== max;
  const bad = !!a && !!b && Number(a) > Number(b);
  const apply = () => !bad && onApply(a, b);
  return (
    <div className="fx-range">
      <div className="fx-range__inputs">
        <input className="input" inputMode={integer ? 'numeric' : 'decimal'} placeholder={placeholders[0]} value={a} onChange={(e) => setA(clean(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && apply()} aria-label={placeholders[0]} />
        <span className="fx-range__to">–</span>
        <input className="input" inputMode={integer ? 'numeric' : 'decimal'} placeholder={placeholders[1]} value={b} onChange={(e) => setB(clean(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && apply()} aria-label={placeholders[1]} />
        {unit && <span className="fx-range__unit">{unit}</span>}
      </div>
      {bad && <span className="tiny" style={{ color: 'var(--bad)' }}>{t('col.rangeBad')}</span>}
      {(dirty || min || max) && (
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn--sm" disabled={!dirty || bad} onClick={apply}>{t('col.apply')}</button>
          {(min || max) && <button type="button" className="btn btn--sm btn--ghost" onClick={() => onApply('', '')}>{t('col.reset')}</button>}
        </div>
      )}
    </div>
  );
}

export function FiltersPanel({ traitsData, filters, onClose, total, connected, isDrawer }: {
  traitsData?: TraitsResponse;
  filters: ReturnType<typeof useMarketFilters>;
  onClose: () => void;
  total: number;
  connected: boolean;
  isDrawer: boolean;
}) {
  const { t, lang } = useI18n();
  const { f, set, clear, activeCount } = filters;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groups = traitsData?.traits ?? [];
  const supply = traitsData?.total || 0;
  const ranked = traitsData?.ranked || 0;
  const needle = search.trim().toLowerCase();
  const shown = useMemo(
    () => groups
      .map((g) => ({
        ...g,
        values: needle && !g.trait_type.toLowerCase().includes(needle)
          ? g.values.filter((v) => (v.value === NO_TRAIT ? t('col.noneValue') : v.value).toLowerCase().includes(needle))
          : g.values,
      }))
      .filter((g) => g.values.length),
    [groups, needle, t],
  );

  function toggleTrait(type: string, value: string) {
    const cur = new Set(f.traits[type] || []);
    cur.has(value) ? cur.delete(value) : cur.add(value);
    const next = { ...f.traits, [type]: [...cur] };
    if (!next[type].length) delete next[type];
    set({ traits: next });
  }

  const tops = [1, 5, 10, 25, 50].filter((p) => Math.ceil((ranked * p) / 100) >= 1 && (p === 1 || Math.ceil((ranked * p) / 100) > 1));
  const topMax = (p: number) => String(Math.max(1, Math.ceil((ranked * p) / 100)));

  return (
    <aside className={`fx ${isDrawer ? 'fx--drawer' : ''}`} aria-label={t('col.filters')}>
      <div className="fx__head">
        <span className="fx__title">{t('col.filters')}{activeCount > 0 && <span className="fx-badge fx-badge--solid">{activeCount}</span>}</span>
        <div className="row" style={{ gap: 4 }}>
          {activeCount > 0 && <button className="btn btn--ghost btn--sm" onClick={clear}>{t('col.clear')}</button>}
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><IconClose size={15} /></button>
        </div>
      </div>

      <div className="fx__scroll">
        <Section title={t('col.status')} badge={f.status !== 'all' ? 1 : 0}>
          <div className="fx-seg" role="radiogroup" aria-label={t('col.status')}>
            {STATUSES.map(([id, key]) => (
              <button key={id} type="button" role="radio" aria-checked={f.status === id} onClick={() => set({ status: id })}>{t(key)}</button>
            ))}
          </div>
          {connected && (
            <label className="fx-switch">
              <input type="checkbox" checked={f.mine} onChange={(e) => set({ mine: e.target.checked })} />
              <span className="fx-switch__track" aria-hidden="true" />
              <span>{t('col.onlyMine')}</span>
            </label>
          )}
        </Section>

        <Section title={t('col.priceRange')} badge={f.min || f.max ? 1 : 0}>
          <RangeInputs min={f.min} max={f.max} unit="ETH" placeholders={[t('col.min'), t('col.max')]}
            onApply={(min, max) => set({ min, max, status: (min || max) && f.status !== 'listed' ? 'listed' : f.status })} />
        </Section>

        {ranked > 1 && (
          <Section title={t('col.rarity')} badge={f.rmin || f.rmax ? 1 : 0}>
            <div className="fx-tops">
              {tops.map((p) => {
                const on = !f.rmin && f.rmax === topMax(p);
                return (
                  <button key={p} type="button" className={`fx-top ${on ? 'is-on' : ''}`} style={toneVars(rarityTone(Number(topMax(p)), ranked))}
                    onClick={() => set(on ? { rmin: '', rmax: '' } : { rmin: '', rmax: topMax(p) })}>
                    <span className="rk rk--plain">{t('rarity.top', { pct: `${p}%` })}</span>
                  </button>
                );
              })}
            </div>
            <span className="tiny muted">{t('col.rankRange', { n: num(ranked, lang) })}</span>
            <RangeInputs min={f.rmin} max={f.rmax} integer placeholders={[t('col.rankFrom'), t('col.rankTo')]} onApply={(rmin, rmax) => set({ rmin, rmax })} />
          </Section>
        )}

        {groups.length > 0 && (
          <div className="fx-traits">
            <div className="fx-traits__head">
              <span className="fx-section__title">{t('col.traits')}</span>
              <span className="tiny muted">{groups.length}</span>
            </div>
            <div className="input-wrap fx-traits__search">
              <span className="prefix-icon"><IconSearch size={15} /></span>
              <input className="input" placeholder={t('col.searchTraits')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {shown.length === 0 && <div className="small muted" style={{ padding: '6px 2px' }}>{t('col.noTraitMatch')}</div>}
            {shown.map((g) => {
              const selected = f.traits[g.trait_type] || [];
              const all = expanded[g.trait_type] || !!needle;
              const values = all ? g.values : g.values.slice(0, 8);
              return (
                <Section key={g.trait_type} defaultOpen={selected.length > 0} forceOpen={!!needle} badge={selected.length}
                  title={<>{g.trait_type} <span className="muted small">{g.values.length}</span></>}>
                  <div className="fx-values">
                    {values.map((v) => {
                      const on = selected.includes(v.value);
                      return (
                        <label className={`fx-value ${on ? 'is-on' : ''}`} key={v.value}>
                          <input type="checkbox" checked={on} onChange={() => toggleTrait(g.trait_type, v.value)} />
                          <span className="fx-value__box" aria-hidden="true" />
                          <span className={`fx-value__name ${v.value === NO_TRAIT ? 'muted' : ''}`}>{v.value === NO_TRAIT ? t('col.noneValue') : v.value}</span>
                          <TraitShare count={v.count} total={supply} />
                        </label>
                      );
                    })}
                    {!all && g.values.length > 8 && (
                      <button type="button" className="fx-more" onClick={() => setExpanded((e) => ({ ...e, [g.trait_type]: true }))}>
                        {t('col.showAllN', { n: g.values.length })}
                      </button>
                    )}
                  </div>
                </Section>
              );
            })}
          </div>
        )}
      </div>

      {isDrawer && (
        <div className="fx__foot">
          {activeCount > 0 && <button className="btn btn--outline" onClick={clear}>{t('col.clear')}</button>}
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>{t('col.showN', { n: num(total, lang) })}</button>
        </div>
      )}
    </aside>
  );
}

/** Chips for the applied filters, each removable. */
export function ActiveFilters({ filters }: { filters: ReturnType<typeof useMarketFilters> }) {
  const { t } = useI18n();
  const { f, set, clear, activeCount } = filters;
  if (!activeCount) return null;
  const statusKey = STATUSES.find(([s]) => s === f.status)?.[1];
  return (
    <div className="active-filters">
      {f.status !== 'all' && statusKey && <button className="chip is-active" onClick={() => set({ status: 'all' })}>{t(statusKey)} <IconClose size={12} /></button>}
      {f.mine && <button className="chip is-active" onClick={() => set({ mine: false })}>{t('col.onlyMine')} <IconClose size={12} /></button>}
      {(f.min || f.max) && <button className="chip is-active" onClick={() => set({ min: '', max: '' })}>{f.min || '0'} – {f.max || '∞'} ETH <IconClose size={12} /></button>}
      {(f.rmin || f.rmax) && <button className="chip is-active" onClick={() => set({ rmin: '', rmax: '' })}>{t('col.rankChip', { from: f.rmin || '1', to: f.rmax || '∞' })} <IconClose size={12} /></button>}
      {Object.entries(f.traits).flatMap(([type, values]) => values.map((v) => (
        <button key={type + v} className="chip is-active" onClick={() => {
          const rest = values.filter((x) => x !== v);
          const next = { ...f.traits, [type]: rest };
          if (!rest.length) delete next[type];
          set({ traits: next });
        }}>{type}: {v === NO_TRAIT ? t('col.noneValue') : v} <IconClose size={12} /></button>
      )))}
      <button className="chip" onClick={clear}>{t('col.clear')}</button>
    </div>
  );
}
