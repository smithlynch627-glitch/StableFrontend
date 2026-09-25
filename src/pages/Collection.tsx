import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { SocialIcon } from '../components/Social';
import type { DictKey } from '../i18n/en';
import { api } from '../lib/api';
import { eth, num, short, shortId, timeAgo } from '../lib/format';
import type { Activity, Collection, DropState, Order, Token, TraitGroup } from '../lib/types';
import { Avatar, CollectionAvatar, CollectionBanner } from '../components/Art';
import { ActivityList } from '../components/ActivityList';
import { IconAlert, IconChevron, IconClose, IconCopy, IconExternal, IconFilter, IconGridLg, IconGridSm, IconSearch, IconShare, IconSweep } from '../components/Icons';
import { BackButton } from '../components/BackButton';
import { SocialLink } from '../components/Social';
import { useAppConfig } from '../lib/appConfig';
import { NftCard } from '../components/NftCard';
import { useTrade } from '../components/trade';
import { Badge, EmptyState, GridSkeleton, Skeleton, Tabs, useToast } from '../components/ui';

type Tab = 'items' | 'offers' | 'activity';

export default function CollectionPage() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('items');
  const q = useQuery({
    queryKey: ['collection', slug.toLowerCase()],
    queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${slug}`),
  });
  useEffect(() => {
    setTab('items');
  }, [slug]);

  if (q.isLoading) return <div className="page container"><Skeleton h={260} r={14} /><div style={{ height: 20 }} /><GridSkeleton /></div>;
  if (!q.data) return <div className="page container"><div className="back-row"><BackButton fallback="/explore" /></div><EmptyState title={t('col.notFound')} action={<Link className="btn" to="/explore">{t('nav.explore')}</Link>} /></div>;
  const { collection: c, drop } = q.data;

  return (
    <>
      <div className="col-banner"><div className="back-float"><BackButton fallback="/explore" /></div><CollectionBanner collection={c} /></div>
      <div className="container">
        <Header c={c} drop={drop} />
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'items', label: t('col.items'), count: c.total_supply },
            { id: 'offers', label: t('col.offers') },
            { id: 'activity', label: t('col.activity') },
          ]}
        />
        {tab === 'items' && <ItemsMarket c={c} />}
        {tab === 'offers' && <OffersTab c={c} />}
        {tab === 'activity' && <ActivityTab collection={c.address} />}
        <div style={{ height: 90 }} />
      </div>
    </>
  );
}

function Header({ c, drop }: { c: Collection; drop: DropState | null }) {
  const { t, lang } = useI18n();
  const trade = useTrade();
  const { address } = useAccount();
  const isCreator = !!address && c.creator === address.toLowerCase();
  const [more, setMore] = useState(false);
  const stats: [string, string][] = [
    [t('common.floor'), c.floor_wei ? `${eth(c.floor_wei)} ETH` : '—'],
    [t('common.bestOffer'), c.best_offer_wei ? `${eth(c.best_offer_wei)} WETH` : '—'],
    [t('common.volume24h'), `${eth(c.volume_24h_wei)} ETH`],
    [t('common.volume'), `${eth(c.volume_wei)} ETH`],
    [t('common.owners'), num(c.owners_count, lang)],
    [t('common.listed'), c.total_supply ? `${((c.listed_count / c.total_supply) * 100).toFixed(1)}%` : '—'],
  ];
  return (
    <div className="col-head">
      <div className="col-head__top">
        <div className="col-avatar" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></div>
        <div className="col-head__title">
          <div className="row" style={{ gap: 8 }}>
            <h1 className="h1">{c.name}</h1>
            <Badge official={c.is_official} verified={c.verified} size={24} />
          </div>
          <div className="row-wrap small soft">
            {c.is_official && <span className="pill pill--solid">{t('common.official')}</span>}
            {c.creator && (
              <Link to={`/profile/${c.creator}`} className="row" style={{ gap: 6 }}>
                <Avatar address={c.creator} size={20} />
                {t('col.by', { creator: short(c.creator) })}
              </Link>
            )}
            {c.max_supply ? <span className="pill pill--outline">{t('col.minted', { n: num(c.total_supply, lang), max: num(c.max_supply, lang) })}</span> : null}
            <span className="pill pill--outline">{t('col.royalty', { pct: c.royalty_bps / 100 })}</span>
            {c.twitter && <SocialLink kind="x" href={c.twitter} size={15} />}
            {c.discord && <SocialLink kind="discord" href={c.discord} size={16} />}
            {c.telegram && <SocialLink kind="telegram" href={c.telegram} size={16} />}
            {c.website && <SocialLink kind="website" href={c.website} size={16} />}
            <MoreMenu c={c} />
          </div>
        </div>
        <div className="col-head__actions">
          {isCreator && !c.is_external && <Link className="btn btn--outline" to={`/studio/${c.slug}`}>{t('col.manage')}</Link>}
          {drop && drop.status !== 'ended' && drop.status !== 'sold_out' && <Link className="btn" to={`/launchpad/${c.slug}`}>{t('col.goMint')}</Link>}
          {c.tradable !== false && <button className="btn btn--outline" onClick={() => trade.offer(c.address)}>{t('col.makeOffer')}</button>}
        </div>
      </div>
      {c.description && (
        <div style={{ maxWidth: 760 }}>
          <p className={`soft ${more ? '' : 'clamp-2'}`}>{c.description}</p>
          {c.description.length > 160 && <button className="link small" style={{ background: 'none', border: 0, padding: 0, marginTop: 4 }} onClick={() => setMore((m) => !m)}>{more ? t('col.less') : t('col.more')}</button>}
        </div>
      )}
      {c.tradable === false && <div className="notice">{t('col.notTradable')}</div>}
      <div className="stats">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}><span className="stat__value mono-num">{value}</span><span className="stat__label">{label}</span></div>
        ))}
      </div>
    </div>
  );
}

const SORTS: [string, DictKey][] = [
  ['price_asc', 'col.sortPriceAsc'], ['price_desc', 'col.sortPriceDesc'], ['recent', 'col.sortRecent'], ['rarity', 'col.sortRarity'], ['id_asc', 'col.sortId'],
];
const PAGE = 40;

function ItemsMarket({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
  const trade = useTrade();
  const { address } = useAccount();
  const [status, setStatus] = useState<'all' | 'listed'>('all');
  const [sort, setSort] = useState('price_asc');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [minMax, setMinMax] = useState({ min: '', max: '' });
  const [applied, setApplied] = useState({ min: '', max: '' });
  const [traits, setTraits] = useState<Record<string, string[]>>({});
  const [grid, setGrid] = useState<'lg' | 'sm'>('lg');
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth > 1100);
  const [sweeping, setSweeping] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const params = {
    status: sweeping ? 'listed' : status,
    sort: sweeping ? 'price_asc' : sort,
    q: debounced,
    min: applied.min,
    max: applied.max,
    traits: Object.keys(traits).length ? JSON.stringify(traits) : '',
  };
  const q = useInfiniteQuery({
    queryKey: ['tokens', c.address, params],
    queryFn: ({ pageParam }) => api.get<{ tokens: Token[]; total: number }>(`/collections/${c.address}/tokens`, { ...params, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE < last.total ? pages.length * PAGE : undefined),
  });
  const tokens = q.data?.pages.flatMap((p) => p.tokens) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const traitQ = useQuery({ queryKey: ['traits', c.address], queryFn: () => api.get<{ traits: TraitGroup[]; total: number }>(`/collections/${c.address}/traits`) });

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

  function toggleTrait(type: string, value: string) {
    setTraits((prev) => {
      const cur = new Set(prev[type] || []);
      cur.has(value) ? cur.delete(value) : cur.add(value);
      const next = { ...prev, [type]: [...cur] };
      if (!next[type].length) delete next[type];
      return next;
    });
  }
  const clearAll = () => { setTraits({}); setApplied({ min: '', max: '' }); setMinMax({ min: '', max: '' }); setStatus('all'); setSearch(''); };
  const activeCount = Object.values(traits).flat().length + (applied.min || applied.max ? 1 : 0) + (status === 'listed' ? 1 : 0);
  const setSweepCount = (n: number) => setSelected(new Set(sweepable.slice(0, n).map((x) => x.token_id)));

  return (
    <div className={`market ${filtersOpen ? '' : 'no-filters'}`}>
      {filtersOpen && (
        <aside className="filters" aria-label={t('col.filters')}>
          <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 6 }}>
            <span className="h3">{t('col.filters')}</span>
            <div className="row" style={{ gap: 4 }}>
              {activeCount > 0 && <button className="btn btn--ghost btn--sm" onClick={clearAll}>{t('col.clear')}</button>}
              <button className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label={t('common.close')}><IconClose size={15} /></button>
            </div>
          </div>
          <details className="filter-group" open>
            <summary>{t('col.status')}<IconChevron size={16} className="chev" /></summary>
            <div className="filter-group__body row-wrap">
              <button className="chip" aria-pressed={status === 'all'} onClick={() => setStatus('all')} disabled={sweeping}>{t('col.all')}</button>
              <button className="chip" aria-pressed={status === 'listed' || sweeping} onClick={() => setStatus('listed')}>{t('col.buyNow')}</button>
            </div>
          </details>
          <details className="filter-group" open>
            <summary>{t('col.priceRange')}<IconChevron size={16} className="chev" /></summary>
            <div className="filter-group__body">
              <div className="row">
                <input className="input" inputMode="decimal" placeholder={t('col.min')} value={minMax.min} onChange={(e) => setMinMax((m) => ({ ...m, min: e.target.value }))} style={{ height: 40 }} />
                <input className="input" inputMode="decimal" placeholder={t('col.max')} value={minMax.max} onChange={(e) => setMinMax((m) => ({ ...m, max: e.target.value }))} style={{ height: 40 }} />
              </div>
              <button className="btn btn--outline btn--sm" onClick={() => { setApplied(minMax); if (minMax.min || minMax.max) setStatus('listed'); }}>{t('col.apply')}</button>
            </div>
          </details>
          {(traitQ.data?.traits ?? []).map((g) => (
            <details className="filter-group" key={g.trait_type}>
              <summary>
                <span>{g.trait_type} <span className="muted small">{g.values.length}</span></span>
                <IconChevron size={16} className="chev" />
              </summary>
              <div className="filter-group__body">
                {g.values.map((v) => (
                  <label className="trait-option" key={v.value}>
                    <span className="checkbox">
                      <input type="checkbox" checked={traits[g.trait_type]?.includes(v.value) ?? false} onChange={() => toggleTrait(g.trait_type, v.value)} />
                      {v.value}
                    </span>
                    <span className="count">{num(v.count, lang)}</span>
                  </label>
                ))}
              </div>
            </details>
          ))}
          <div className="hide-md" style={{ height: 20 }} />
          <button className="btn btn--block" style={{ marginTop: 12 }} onClick={() => setFiltersOpen(false)} hidden={window.innerWidth > 1100}>{t('col.apply')}</button>
        </aside>
      )}
      {filtersOpen && window.innerWidth <= 1100 && <div className="drawer-backdrop" style={{ zIndex: 89 }} onClick={() => setFiltersOpen(false)} />}

      <div>
        <div className="toolbar">
          <button className="icon-btn" aria-pressed={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} aria-label={t('col.filters')}>
            <IconFilter size={17} />
          </button>
          <div className="input-wrap">
            <span className="prefix-icon"><IconSearch size={16} /></span>
            <input className="input" style={{ height: 42 }} placeholder={t('col.searchId')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 'auto', height: 42 }} value={sweeping ? 'price_asc' : sort} onChange={(e) => setSort(e.target.value)} disabled={sweeping} aria-label="Sort">
            {SORTS.map(([id, key]) => <option key={id} value={id}>{t(key)}</option>)}
          </select>
          <div className="segmented hide-sm">
            <button aria-pressed={grid === 'lg'} onClick={() => setGrid('lg')} aria-label={t('col.large')}><IconGridLg size={15} /></button>
            <button aria-pressed={grid === 'sm'} onClick={() => setGrid('sm')} aria-label={t('col.small')}><IconGridSm size={15} /></button>
          </div>
          <button
            className={`btn btn--sm ${sweeping ? '' : 'btn--outline'}`}
            style={{ height: 42 }}
            onClick={() => { setSweeping((s) => !s); setSelected(new Set()); }}
            aria-pressed={sweeping}
            disabled={c.tradable === false}
            title={c.tradable === false ? t('col.notTradable') : undefined}
          >
            <IconSweep size={16} />{sweeping ? t('col.cancelSweep') : t('col.sweep')}
          </button>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="small soft">{t('col.count', { n: num(total, lang) })}</span>
        </div>

        {activeCount > 0 && (
          <div className="active-filters">
            {status === 'listed' && <button className="chip is-active" onClick={() => setStatus('all')}>{t('col.buyNow')} <IconClose size={12} /></button>}
            {(applied.min || applied.max) && <button className="chip is-active" onClick={() => { setApplied({ min: '', max: '' }); setMinMax({ min: '', max: '' }); }}>{applied.min || '0'} – {applied.max || '∞'} ETH <IconClose size={12} /></button>}
            {Object.entries(traits).flatMap(([type, values]) => values.map((v) => (
              <button key={type + v} className="chip is-active" onClick={() => toggleTrait(type, v)}>{type}: {v} <IconClose size={12} /></button>
            )))}
            <button className="chip" onClick={clearAll}>{t('col.clear')}</button>
          </div>
        )}

        {q.isLoading ? (
          <GridSkeleton count={12} />
        ) : tokens.length === 0 ? (
          <EmptyState title={t('col.noItems')} action={activeCount ? <button className="btn btn--outline" onClick={clearAll}>{t('col.clearFilters')}</button> : undefined} />
        ) : (
          <div className={`nft-grid ${grid === 'sm' ? 'nft-grid--small' : ''}`}>
            {tokens.map((tok) => (
              <NftCard
                key={tok.token_id}
                token={tok}
                collection={c}
                sweeping={sweeping}
                selected={selected.has(tok.token_id)}
                onToggle={() => setSelected((s) => { const n = new Set(s); n.has(tok.token_id) ? n.delete(tok.token_id) : n.add(tok.token_id); return n; })}
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
          <span className="strong mono-num nowrap">{eth(selectedTotal)} ETH</span>
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

/** ⋯ menu: view contract on-chain, copy/share the collection link, share on X, report. */
function MoreMenu({ c }: { c: Collection }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const link = `${window.location.origin}/collection/${c.slug}`;
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => toast(t('col.linkCopied')));
    setOpen(false);
  };
  const share = async () => {
    setOpen(false);
    if (navigator.share) await navigator.share({ title: c.name, url: link }).catch(() => undefined);
    else copy();
  };
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={t('col.moreOptions')} aria-expanded={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
      {open && (
        <div className="dropdown__menu menu-list" role="menu" style={{ right: 'auto', left: 0 }}>
          <a href={`${cfg.explorerUrl}/address/${c.address}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><IconExternal size={16} />{t('col.viewOnChain')}</a>
          <button onClick={copy}><IconCopy size={16} />{t('col.copyLink')}</button>
          <button onClick={share}><IconShare size={16} />{t('col.share')}</button>
          <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(c.name)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><SocialIcon kind="x" size={14} />{t('col.shareX')}</a>
          <Link to={`/support?category=report&collection=${c.address}`} onClick={() => setOpen(false)}><IconAlert size={16} />{t('col.report')}</Link>
        </div>
      )}
    </div>
  );
}

function OffersTab({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
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
                <td className="strong mono-num">{eth(o.price_wei)} WETH</td>
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
