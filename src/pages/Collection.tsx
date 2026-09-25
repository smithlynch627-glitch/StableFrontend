import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { api } from '../lib/api';
import { eth, num, short, shortId, timeAgo, tokenLabel } from '../lib/format';
import { useMoney } from '../lib/currency';
import type { Activity, Collection, DropState, Order, Token, TraitsResponse } from '../lib/types';
import { CollectionAvatar, CollectionBanner, TokenArt } from '../components/Art';
import { HoldersTab } from '../components/collection/HoldersTab';
import { AnalyticsTab } from '../components/collection/AnalyticsTab';
import { AboutTab } from '../components/collection/AboutTab';
import { CollectionMetaRow, useChainMinted } from '../components/collection/CollectionMeta';
import { ActivityList } from '../components/ActivityList';
import { IconChart, IconCheck, IconChevron, IconExternal, IconFilter, IconGridLg, IconGridSm, IconList, IconSearch, IconSweep } from '../components/Icons';
import { ActiveFilters, FiltersPanel, SORTS, useMarketFilters } from '../components/collection/Filters';
import { RarityRank } from '../components/Rarity';
import { BackButton } from '../components/BackButton';
import { NftCard } from '../components/NftCard';
import { useTrade } from '../components/trade';
import { Badge, EmptyState, GridSkeleton, Skeleton, Tabs } from '../components/ui';

type Tab = 'items' | 'offers' | 'activity' | 'holders' | 'analytics' | 'about';
const TABS: Tab[] = ['items', 'offers', 'activity', 'holders', 'analytics', 'about'];

export default function CollectionPage() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'items';
  const setTab = (next: Tab) => {
    setParams(next === 'items' ? {} : { tab: next }, { replace: true });
    if (next !== tab) document.querySelector('.col-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const q = useQuery({
    queryKey: ['collection', slug.toLowerCase()],
    queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${slug}`),
  });

  if (q.isLoading) return <div className="page container"><Skeleton h={260} r={14} /><div style={{ height: 20 }} /><GridSkeleton /></div>;
  if (!q.data) return <div className="page container"><div className="back-row"><BackButton fallback="/explore" /></div><EmptyState title={t('col.notFound')} action={<Link className="btn" to="/explore">{t('nav.explore')}</Link>} /></div>;
  const { collection: c, drop } = q.data;

  return (
    <>
      <div className="col-banner"><div className="back-float"><BackButton fallback="/explore" /></div><CollectionBanner collection={c} /></div>
      <div className="container">
        <Header c={c} drop={drop} />
        <div className="col-tabs">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'items', label: t('col.items'), count: c.total_supply },
              { id: 'offers', label: t('col.offers') },
              { id: 'activity', label: t('col.activity') },
              { id: 'holders', label: t('col.holders'), count: c.owners_count || undefined },
              { id: 'analytics', label: t('col.analytics') },
              { id: 'about', label: t('col.about') },
            ]}
          />
        </div>
        <div className="tab-panel" key={tab}>
          {tab === 'items' && <ItemsMarket c={c} onAnalytics={() => setTab('analytics')} />}
          {tab === 'offers' && <OffersTab c={c} />}
          {tab === 'activity' && <ActivityTab collection={c.address} />}
          {tab === 'holders' && <HoldersTab c={c} />}
          {tab === 'analytics' && <AnalyticsTab c={c} />}
          {tab === 'about' && <AboutTab c={c} />}
        </div>
        <div style={{ height: 90 }} />
      </div>
    </>
  );
}

function Header({ c, drop }: { c: Collection; drop: DropState | null }) {
  const { t, lang } = useI18n();
  const trade = useTrade();
  const { money, usd, isUsd } = useMoney();
  const { address } = useAccount();
  const isCreator = !!address && c.creator === address.toLowerCase();
  const { soldOut: chainSoldOut } = useChainMinted(c);
  const stats: [string, ReactNode][] = [
    // The floor always stays in ETH (with the USD value underneath when USD is selected).
    [t('common.floor'), c.floor_wei ? <>{eth(c.floor_wei)} ETH{isUsd && <span className="stat__sub">{usd(c.floor_wei)}</span>}</> : '—'],
    [t('common.bestOffer'), c.best_offer_wei ? money(c.best_offer_wei, 'WETH') : '—'],
    [t('common.volume24h'), money(c.volume_24h_wei)],
    [t('common.volume'), money(c.volume_wei)],
    [t('common.owners'), num(c.owners_count, lang)],
    [t('common.listed'), c.total_supply ? `${((c.listed_count / c.total_supply) * 100).toFixed(1)}%` : '—'],
  ];
  return (
    <div className="col-head">
      <div className="col-head__top">
        <div className="col-avatar" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></div>
        <div className="col-head__title">
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <h1 className="h1">{c.name}</h1>
            <Badge official={c.is_official} verified={c.verified} size={24} />
          </div>
          <CollectionMetaRow c={c} />
        </div>
        <div className="col-head__actions">
          {isCreator && !c.is_external && <Link className="btn btn--outline" to={`/studio/${c.slug}`}>{t('col.manage')}</Link>}
          {drop && drop.status !== 'ended' && drop.status !== 'sold_out' && !chainSoldOut && <Link className="btn" to={`/launchpad/${c.slug}`}>{t('col.goMint')}</Link>}
          {c.tradable !== false && <button className="btn btn--outline" onClick={() => trade.offer(c.address)}>{t('col.makeOffer')}</button>}
        </div>
      </div>
      {c.tradable === false && <div className="notice">{t('col.notTradable')}</div>}
      <div className="stats">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}><span className="stat__value mono-num">{value}</span><span className="stat__label">{label}</span></div>
        ))}
      </div>
    </div>
  );
}

const PAGE = 40;
type View = 'lg' | 'sm' | 'list';
const VIEW_KEY = 'stable.collectionView';
const readView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'sm' || v === 'list' ? v : 'lg';
  } catch {
    return 'lg';
  }
};

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

function ItemsMarket({ c, onAnalytics }: { c: Collection; onAnalytics: () => void }) {
  const { t, lang } = useI18n();
  const trade = useTrade();
  const { money } = useMoney();
  const { address } = useAccount();
  const filters = useMarketFilters();
  const { f, set, clear, activeCount } = filters;
  const [search, setSearch] = useState(f.q);
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };
  const narrow = useMedia('(max-width: 1100px)');
  const [filtersOpen, setFiltersOpen] = useState(() => !window.matchMedia('(max-width: 1100px)').matches);
  const [sweeping, setSweeping] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sentinel = useRef<HTMLDivElement>(null);

  // Search box → URL after a short pause.
  useEffect(() => {
    if (search.trim() === f.q) return;
    const id = setTimeout(() => set({ q: search }), 300);
    return () => clearTimeout(id);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!f.q && search) setSearch(''); }, [f.q]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opening the drawer on a phone: stop the page behind it from scrolling.
  useEffect(() => {
    if (!(narrow && filtersOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [narrow, filtersOpen]);

  const params = {
    status: sweeping ? 'listed' : f.status,
    sort: sweeping ? 'price_asc' : f.sort,
    q: f.q,
    min: f.min,
    max: f.max,
    rank_min: f.rmin,
    rank_max: f.rmax,
    owner: f.mine && address ? address.toLowerCase() : '',
    traits: Object.keys(f.traits).length ? JSON.stringify(f.traits) : '',
  };
  const q = useInfiniteQuery({
    queryKey: ['tokens', c.address, params],
    queryFn: ({ pageParam }) => api.get<{ tokens: Token[]; total: number }>(`/collections/${c.address}/tokens`, { ...params, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE < last.total ? pages.length * PAGE : undefined),
    placeholderData: (prev) => prev,
  });
  const tokens = q.data?.pages.flatMap((p) => p.tokens) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const traitQ = useQuery({ queryKey: ['traits', c.address], queryFn: () => api.get<TraitsResponse>(`/collections/${c.address}/traits`) });

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  const sweepable = useMemo(
    () => tokens.filter((x) => x.listing_hash && x.owner.toLowerCase() !== address?.toLowerCase()).slice(0, 50),
    [tokens, address],
  );
  const selectedTokens = sweepable.filter((x) => selected.has(x.token_id));
  const selectedTotal = selectedTokens.reduce((s, x) => s + BigInt(x.listing_price_wei || 0), 0n);
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setSweepCount = (n: number) => setSelected(new Set(sweepable.slice(0, n).map((x) => x.token_id)));
  const clearAll = () => { clear(); setSearch(''); };

  return (
    <div className={`market ${filtersOpen ? '' : 'no-filters'}`}>
      {filtersOpen && !narrow && (
        <FiltersPanel traitsData={traitQ.data} filters={filters} onClose={() => setFiltersOpen(false)} total={total} connected={!!address} isDrawer={false} />
      )}
      {/* On phones the filters slide in over the page (rendered at the top level so nothing clips them). */}
      {filtersOpen && narrow && createPortal(
        <>
          <div className="drawer-backdrop" style={{ zIndex: 89 }} onClick={() => setFiltersOpen(false)} />
          <FiltersPanel traitsData={traitQ.data} filters={filters} onClose={() => setFiltersOpen(false)} total={total} connected={!!address} isDrawer />
        </>,
        document.body,
      )}

      <div style={{ minWidth: 0 }}>
        <div className="toolbar">
          <button className={`btn btn--outline btn--sm toolbar__btn fx-toggle ${filtersOpen ? 'is-on' : ''}`} aria-pressed={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} aria-label={t('col.filters')}>
            <IconFilter size={17} /><span className="hide-sm">{t('col.filters')}</span>
            {activeCount > 0 && <span className="fx-badge fx-badge--solid">{activeCount}</span>}
          </button>
          <div className="input-wrap">
            <span className="prefix-icon"><IconSearch size={16} /></span>
            <input className="input" style={{ height: 42 }} placeholder={t('col.searchId')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select toolbar__sort" value={sweeping ? 'price_asc' : f.sort} onChange={(e) => set({ sort: e.target.value })} disabled={sweeping} aria-label={t('col.sort')}>
            {SORTS.map(([id, key]) => <option key={id} value={id}>{t(key)}</option>)}
          </select>
          <ViewMenu value={view} onChange={setView} />
          <button className="btn btn--outline btn--sm toolbar__btn" onClick={onAnalytics}>
            <IconChart size={16} /><span className="hide-sm">{t('col.analytics')}</span>
          </button>
          <button
            className={`btn btn--sm toolbar__btn ${sweeping ? '' : 'btn--outline'}`}
            onClick={() => { setSweeping((s) => !s); setSelected(new Set()); }}
            aria-pressed={sweeping}
            disabled={c.tradable === false}
            title={c.tradable === false ? t('col.notTradable') : undefined}
          >
            <IconSweep size={16} />{sweeping ? t('col.cancelSweep') : t('col.sweep')}
          </button>
        </div>

        <div className="market__count">
          <span className="small soft">{t('col.count', { n: num(total, lang) })}</span>
          {q.isFetching && !q.isFetchingNextPage && <span className="spinner" style={{ width: 13, height: 13 }} />}
        </div>

        <ActiveFilters filters={filters} />

        {q.isLoading ? (
          <GridSkeleton count={12} />
        ) : tokens.length === 0 ? (
          <EmptyState title={t('col.noItems')} action={activeCount || f.q ? <button className="btn btn--outline" onClick={clearAll}>{t('col.clearFilters')}</button> : undefined} />
        ) : view === 'list' ? (
          <TokenTable c={c} tokens={tokens} sweeping={sweeping} selected={selected} onToggle={toggleSelect} />
        ) : (
          <div className={`nft-grid ${view === 'sm' ? 'nft-grid--small' : ''} ${q.isPlaceholderData ? 'is-stale' : ''}`}>
            {tokens.map((tok) => (
              <NftCard
                key={tok.token_id}
                token={tok}
                collection={c}
                sweeping={sweeping}
                selected={selected.has(tok.token_id)}
                onToggle={() => toggleSelect(tok.token_id)}
                onQuickSelect={() => { setSweeping(true); setSelected(new Set([tok.token_id])); }}
              />
            ))}
          </div>
        )}
        <div ref={sentinel} style={{ height: 1 }} />
        {q.isFetchingNextPage && <div style={{ marginTop: 14 }}><GridSkeleton count={5} /></div>}
      </div>

      {sweeping && (
        <div className="sweep-bar" role="region" aria-label={t('col.sweep')}>
          <div style={{ display: 'grid', gap: 2, minWidth: 110 }}>
            <span className="strong">{t('col.selected', { n: selected.size })}</span>
            <span className="tiny" style={{ opacity: 0.7 }}>{t('col.sweepHint')}</span>
          </div>
          <input type="range" min={0} max={sweepable.length} value={selected.size} onChange={(e) => setSweepCount(Number(e.target.value))} aria-label={t('col.sweep')} />
          <span className="strong mono-num nowrap" title={`${eth(selectedTotal)} ETH`}>{money(selectedTotal)}</span>
          <div className="sweep-bar__actions">
            <button className="btn btn--ghost sweep-bar__cancel" onClick={() => { setSweeping(false); setSelected(new Set()); }}>{t('col.cancelSweep')}</button>
            <button className="btn" disabled={!selected.size} onClick={() => trade.buy(c.address, selectedTokens)}>
              {t('col.sweepBuy', { n: selected.size })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "View" dropdown: large grid, small grid or list. */
function ViewMenu({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const options: [View, ReactNode, DictKey, DictKey][] = [
    ['lg', <IconGridLg size={16} />, 'col.viewLarge', 'col.viewLargeHint'],
    ['sm', <IconGridSm size={16} />, 'col.viewSmall', 'col.viewSmallHint'],
    ['list', <IconList size={16} />, 'col.viewList', 'col.viewListHint'],
  ];
  const current = options.find((o) => o[0] === value)!;
  return (
    <div className="dropdown" ref={ref}>
      <button className="btn btn--outline btn--sm toolbar__btn view-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {current[1]}<span className="hide-sm">{t(current[2])}</span><IconChevron size={14} />
      </button>
      {open && (
        <div className="dropdown__menu view-menu" role="listbox" aria-label={t('col.view')}>
          <div className="view-menu__head tiny muted">{t('col.view')}</div>
          {options.map(([id, icon, label, hint]) => (
            <button key={id} role="option" aria-selected={value === id} onClick={() => { onChange(id); setOpen(false); }}>
              <span className="view-menu__icon">{icon}</span>
              <span style={{ display: 'grid', flex: 1, textAlign: 'left' }}>
                <span className="strong">{t(label)}</span>
                <span className="tiny muted">{t(hint)}</span>
              </span>
              {value === id && <IconCheck size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** List view: one row per item with price, last sale, owner and a quick action. */
function TokenTable({ c, tokens, sweeping, selected, onToggle }: { c: Collection; tokens: Token[]; sweeping: boolean; selected: Set<string>; onToggle: (id: string) => void }) {
  const { t } = useI18n();
  const { money } = useMoney();
  const trade = useTrade();
  const nav = useNavigate();
  const { address } = useAccount();
  const me = address?.toLowerCase();
  return (
    <div className="table-wrap token-table">
      <table className="table">
        <thead>
          <tr>
            <th>{t('common.item')}</th>
            <th>{t('common.price')}</th>
            <th className="hide-sm">{t('col.lastSale')}</th>
            <th className="hide-md">{t('col.rarity')}</th>
            <th className="hide-sm">{t('common.owner')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tokens.map((tok) => {
            const mine = tok.owner?.toLowerCase() === me;
            const listed = !!tok.listing_hash;
            const selectable = sweeping && listed && !mine;
            return (
              <tr key={tok.token_id} className={`clickable ${selected.has(tok.token_id) ? 'is-selected' : ''}`}
                onClick={() => (sweeping ? selectable && onToggle(tok.token_id) : nav(`/item/${c.slug}/${tok.token_id}`))}>
                <td>
                  <span className="cell-item">
                    {sweeping && <span className={`tick ${selected.has(tok.token_id) ? 'is-on' : ''} ${selectable ? '' : 'is-off'}`}>{selected.has(tok.token_id) && <IconCheck size={12} />}</span>}
                    <span className="thumb thumb--sm" style={{ position: 'relative' }}><TokenArt collection={c} token={tok} /></span>
                    <span className="strong ellipsis">{tokenLabel(tok.name, tok.token_id)}</span>
                  </span>
                </td>
                <td className="strong mono-num">{listed ? money(tok.listing_price_wei) : <span className="muted">—</span>}</td>
                <td className="hide-sm mono-num muted">{tok.last_sale_wei ? money(tok.last_sale_wei) : '—'}</td>
                <td className="hide-md">{tok.rarity_rank ? <RarityRank rank={tok.rarity_rank} of={c.total_supply} variant="chip" /> : <span className="muted">—</span>}</td>
                <td className="hide-sm">{mine ? t('common.you') : <Link className="link" to={`/profile/${tok.owner}`} onClick={(e) => e.stopPropagation()}>{short(tok.owner)}</Link>}</td>
                <td style={{ textAlign: 'right' }}>
                  {!sweeping && c.tradable !== false && (listed && !mine ? (
                    <button className="btn btn--sm" onClick={(e) => { e.stopPropagation(); trade.buy(c.address, [tok]); }}>{t('col.buyNow')}</button>
                  ) : mine ? (
                    <button className="btn btn--outline btn--sm" onClick={(e) => { e.stopPropagation(); trade.list(c.address, tok); }}>{listed ? t('item.editPrice') : t('item.list')}</button>
                  ) : null)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** ⋯ menu: view contract on-chain, copy/share the collection link, share on X, report. */
function OffersTab({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const trade = useTrade();
  const { address } = useAccount();
  const offers = useQuery({ queryKey: ['offers', c.address], queryFn: () => api.get<{ offers: Order[] }>(`/collections/${c.address}/offers`) });
  const holding = useQuery({
    queryKey: ['tokens', c.address, 'owner', address, 'count'],
    queryFn: () => api.get<{ tokens: Token[]; total: number }>(`/collections/${c.address}/tokens`, { owner: address, limit: 1 }),
    enabled: !!address,
  });
  const holds = (holding.data?.total ?? 0) > 0;
  const list = offers.data?.offers ?? [];
  if (offers.isLoading) return <Skeleton h={240} r={14} />;
  if (!list.length) return <EmptyState title={t('col.offersEmpty')} action={<button className="btn" onClick={() => trade.offer(c.address)}>{t('col.makeOffer')}</button>} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>{t('common.price')}</th><th>{t('common.item')}</th><th>{t('common.from')}</th><th>{t('common.expires')}</th><th /></tr></thead>
        <tbody>
          {list.map((o) => {
            const mine = address && o.maker === address.toLowerCase();
            return (
              <tr key={o.hash}>
                <td className="strong mono-num">{money(o.price_wei, 'WETH')}</td>
                <td>{o.kind === 'collection_offer' ? <span className="pill">{t('col.collectionOffer')}</span> : <Link className="link" to={`/item/${c.slug}/${o.token_id}`}>#{shortId(o.token_id)}</Link>}</td>
                <td><Link className="link" to={`/profile/${o.maker}`}>{mine ? t('common.you') : short(o.maker)}</Link></td>
                <td className="muted">{timeAgo(o.end_time, lang)}</td>
                <td style={{ textAlign: 'right' }}>
                  {mine ? (
                    <button className="btn btn--outline btn--sm" onClick={() => trade.cancel(o, c.address)}>{t('item.cancelOffer')}</button>
                  ) : o.kind === 'collection_offer' && holds ? (
                    <button className="btn btn--sm" onClick={() => trade.accept(o, c.address)}>{t('item.accept')}</button>
                  ) : o.kind === 'offer' ? (
                    <Link className="btn btn--ghost btn--sm" to={`/item/${c.slug}/${o.token_id}`}><IconExternal size={14} /></Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TYPES = ['sale', 'list', 'offer', 'collection_offer', 'mint', 'transfer'] as const;

export function ActivityTab({ collection, address, token }: { collection?: string; address?: string; token?: string }) {
  const { t } = useI18n();
  const [types, setTypes] = useState<string[]>([]);
  const q = useInfiniteQuery({
    queryKey: ['activity', { collection, address, token, types }],
    queryFn: ({ pageParam }) => api.get<{ activity: Activity[]; nextBefore: number | null }>('/activity', { collection, address, token, types: types.join(','), before: pageParam, limit: 30 }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.activity) ?? [];
  const toggle = (ty: string) => setTypes((cur) => (cur.includes(ty) ? cur.filter((x) => x !== ty) : [...cur, ty]));
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row-wrap">
        <button className="chip" aria-pressed={types.length === 0} onClick={() => setTypes([])}>{t('act.all')}</button>
        {TYPES.map((ty) => <button key={ty} className="chip" aria-pressed={types.includes(ty)} onClick={() => toggle(ty)}>{t(`act.type.${ty}` as DictKey)}</button>)}
      </div>
      {q.isLoading ? <Skeleton h={300} r={14} /> : items.length === 0 ? <EmptyState title={t('act.empty')} /> : <ActivityList items={items} />}
      {q.hasNextPage && (
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <button className="btn btn--outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>{t('common.loadMore')}</button>
        </div>
      )}
    </div>
  );
}
