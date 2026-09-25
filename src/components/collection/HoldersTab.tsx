// Holders: who owns the collection, how much, and how they have traded it, as a sortable, filterable list.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/en';
import { api } from '../../lib/api';
import { num, short } from '../../lib/format';
import { useMoney } from '../../lib/currency';
import type { Collection, HoldersResponse } from '../../lib/types';
import { Avatar, TokenArt } from '../Art';
import { HBars } from '../Charts';
import { IconChevron, IconSearch, IconUser } from '../Icons';
import { EmptyState, Skeleton } from '../ui';

type SortKey = 'held' | 'minted' | 'bought' | 'sold' | 'spent' | 'volume' | 'pnl';
type Who = 'all' | 'minters' | 'buyers' | 'sellers' | 'profit' | 'loss';
const WHO: [Who, DictKey][] = [
  ['all', 'holders.whoAll'], ['minters', 'holders.whoMinters'], ['buyers', 'holders.whoBuyers'],
  ['sellers', 'holders.whoSellers'], ['profit', 'holders.whoProfit'], ['loss', 'holders.whoLoss'],
];
const MIN_HELD = [0, 2, 5, 10, 25];
const PAGE = 50;
const pctText = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

export function HoldersTab({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
  const { money, signed } = useMoney();
  const { address } = useAccount();
  const nav = useNavigate();
  const me = address?.toLowerCase();
  const [sort, setSort] = useState<SortKey>('held');
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');
  const [who, setWho] = useState<Who>('all');
  const [minHeld, setMinHeld] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: ['holders', c.address, sort, dir, who, minHeld, q],
    queryFn: ({ pageParam }) => api.get<HoldersResponse>(`/collections/${c.address}/holders`, { sort, dir, type: who, min_held: minHeld || '', q, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE < last.total ? pages.length * PAGE : undefined),
    placeholderData: keepPreviousData,
  });
  const first = query.data?.pages[0];
  const holders = query.data?.pages.flatMap((p) => p.holders) ?? [];
  if (query.isLoading) return <div style={{ display: 'grid', gap: 14 }}><Skeleton h={96} r={14} /><Skeleton h={420} r={14} /></div>;
  if (!first) return <EmptyState title={t('holders.empty')} />;
  const s = first.summary;
  if (!s.holders) return <EmptyState title={t('holders.empty')} />;
  const filtered = who !== 'all' || minHeld > 0 || !!q;
  const maxHeld = Math.max(1, ...holders.map((h) => h.held));

  const sortBy = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSort(key); setDir('desc'); }
  };
  const th = (k: SortKey, label: string, className = '') => (
    <th key={k} className={`hl-th ${className}`} aria-sort={sort === k ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => sortBy(k)} className={sort === k ? 'is-on' : ''}>
        {label}
        <IconChevron size={13} className={`hl-th__chev ${sort === k && dir === 'asc' ? 'is-up' : ''}`} />
      </button>
    </th>
  );

  return (
    <div className="holders-v3">
      <div className="holders-v3__top">
        <div className="kpi-grid holders-v3__kpis">
          <Kpi label={t('holders.count')} value={num(s.holders, lang)} />
          <Kpi label={t('holders.unique')} value={pctText(s.uniquePct)} hint={t('holders.uniqueHint')} />
          <Kpi label={t('holders.avg')} value={s.avgHeld.toFixed(s.avgHeld < 10 ? 2 : 1)} />
          <Kpi label={t('holders.top10')} value={pctText(s.top10Pct)} hint={t('holders.top10Hint')} />
        </div>
        <section className="chart-card holders-v3__dist">
          <header className="chart-card__head"><div><h3 className="h3">{t('holders.distribution')}</h3><div className="small muted">{t('holders.distributionSub')}</div></div></header>
          <HBars rows={s.distribution.map((d) => ({ label: t('holders.bucket', { n: d.label }), v: d.count }))} fmt={(v) => num(v, lang)} />
        </section>
      </div>

      <section className="card-v3 holders-v3__list">
        <header className="hl-head">
          <div style={{ minWidth: 0 }}>
            <h3 className="h3">{t('holders.title')} <span className="muted small mono-num">{num(first.total, lang)}{filtered ? ` / ${num(s.holders, lang)}` : ''}</span></h3>
            <div className="tiny muted">{t('holders.pnlHint')}</div>
          </div>
          <div className="hl-head__tools">
            <div className="input-wrap hl-search">
              <span className="prefix-icon"><IconSearch size={15} /></span>
              <input className="input" placeholder={t('holders.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {me && (
              <button type="button" className={`btn btn--outline btn--sm ${q === me ? 'is-on' : ''}`} onClick={() => setSearch(q === me ? '' : me)}>
                <IconUser size={15} />{t('holders.findMe')}
              </button>
            )}
          </div>
        </header>

        <div className="hl-filters">
          <div className="hl-who" role="radiogroup" aria-label={t('holders.show')}>
            {WHO.map(([id, key]) => (
              <button key={id} type="button" role="radio" aria-checked={who === id} className="chip" aria-pressed={who === id} onClick={() => setWho(id)}>{t(key)}</button>
            ))}
          </div>
          <select className="select select--sm" value={minHeld} onChange={(e) => setMinHeld(Number(e.target.value))} aria-label={t('holders.minHeld')}>
            {MIN_HELD.map((n) => <option key={n} value={n}>{n ? t('holders.holdsN', { n }) : t('holders.holdsAny')}</option>)}
          </select>
          <select className="select select--sm hl-sort-mobile" value={`${sort}:${dir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSort(k as SortKey); setDir(d as 'asc' | 'desc'); }} aria-label={t('col.sort')}>
            {(['held', 'pnl', 'volume', 'spent', 'minted', 'bought', 'sold'] as SortKey[]).flatMap((k) => [
              <option key={`${k}:desc`} value={`${k}:desc`}>{t(`holders.${k}` as DictKey)} ↓</option>,
              <option key={`${k}:asc`} value={`${k}:asc`}>{t(`holders.${k}` as DictKey)} ↑</option>,
            ])}
          </select>
        </div>

        {holders.length === 0 ? (
          <div className="hl-empty small muted">{t('holders.noMatch')}</div>
        ) : (
          <div className={`table-wrap hl-wrap ${query.isPlaceholderData ? 'is-stale' : ''}`}>
            <table className="table hl-table">
              <thead>
                <tr>
                  <th className="hl-rank">#</th>
                  <th>{t('holders.holder')}</th>
                  {th('held', t('holders.held'), 'hide-sm')}
                  {th('minted', t('holders.minted'), 'hide-md')}
                  {th('bought', t('holders.bought'), 'hide-md')}
                  {th('sold', t('holders.sold'), 'hide-md')}
                  {th('spent', t('holders.spent'), 'hide-lg')}
                  {th('volume', t('holders.volume'), 'hide-lg')}
                  {th('pnl', t('holders.pnl'))}
                  <th className="hide-sm hl-samples-th">{t('holders.samples')}</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((h) => {
                  const pnl = BigInt(h.pnl || '0');
                  const isMe = h.owner === me;
                  return (
                    <tr key={h.owner} className={`clickable ${isMe ? 'is-me' : ''}`} onClick={() => nav(`/profile/${h.owner}`)}>
                      <td className="hl-rank mono-num">{h.rank}</td>
                      <td>
                        <Link to={`/profile/${h.owner}`} className="hl-who-cell" onClick={(e) => e.stopPropagation()}>
                          <Avatar address={h.owner} size={32} />
                          <span style={{ display: 'grid', minWidth: 0 }}>
                            <span className="strong ellipsis">{isMe ? t('common.you') : h.username || short(h.owner)}</span>
                            {(isMe || h.username) && <span className="tiny muted mono-num hide-sm">{short(h.owner)}</span>}
                            <span className="tiny muted mono-num hl-sub-sm">{t('holders.items', { n: num(h.held, lang) })} · {pctText(h.share)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hide-sm">
                        <div className="hl-held">
                          <span className="strong mono-num">{num(h.held, lang)}</span>
                          <span className="tiny muted mono-num">{pctText(h.share)}</span>
                        </div>
                        <span className="hl-bar"><span style={{ width: `${Math.max(4, (h.held / maxHeld) * 100)}%` }} /></span>
                      </td>
                      <td className="hide-md mono-num">{num(h.minted, lang)}</td>
                      <td className="hide-md mono-num">{num(h.bought, lang)}</td>
                      <td className="hide-md mono-num">{num(h.sold, lang)}</td>
                      <td className="hide-lg mono-num">{money(h.spent)}</td>
                      <td className="hide-lg mono-num">{money(h.volume)}</td>
                      <td className={`mono-num strong ${pnl > 0n ? 'up' : pnl < 0n ? 'down' : ''}`}>{signed(h.pnl)}</td>
                      <td className="hide-sm">
                        <div className="hl-samples">
                          {h.samples.slice(0, 4).map((x) => (
                            <Link key={x.token_id} to={`/item/${c.slug}/${x.token_id}`} className="holder-thumb" title={x.name || `#${x.token_id}`} onClick={(e) => e.stopPropagation()}>
                              <TokenArt collection={c} token={{ token_id: x.token_id, image_url: x.image_url }} />
                            </Link>
                          ))}
                          {h.held > 4 && <span className="holder-thumb holder-thumb--more tiny">+{num(h.held - 4, lang)}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {query.hasNextPage && (
          <div style={{ display: 'grid', placeItems: 'center', paddingTop: 12 }}>
            <button className="btn btn--outline btn--sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{t('common.loadMore')}</button>
          </div>
        )}
      </section>
    </div>
  );
}

export function Kpi({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: { text: string; up: boolean } | null }) {
  return (
    <div className="kpi" title={hint}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value mono-num">{value}</span>
      {delta && <span className={`kpi__delta ${delta.up ? 'up' : 'down'}`}>{delta.up ? '▲' : '▼'} {delta.text}</span>}
    </div>
  );
}
