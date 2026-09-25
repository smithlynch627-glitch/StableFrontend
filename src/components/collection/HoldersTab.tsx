// Holders: who owns the collection, how much, and how they have traded it.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { num, short } from '../../lib/format';
import { useMoney } from '../../lib/currency';
import type { Collection, HoldersResponse } from '../../lib/types';
import { Avatar, TokenArt } from '../Art';
import { HBars } from '../Charts';
import { EmptyState, Skeleton } from '../ui';

type Sort = 'held' | 'pnl' | 'volume';
const PAGE = 50;
const pctText = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

export function HoldersTab({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
  const { money, signed } = useMoney();
  const { address } = useAccount();
  const [sort, setSort] = useState<Sort>('held');
  const q = useInfiniteQuery({
    queryKey: ['holders', c.address, sort],
    queryFn: ({ pageParam }) => api.get<HoldersResponse>(`/collections/${c.address}/holders`, { sort, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE < last.total ? pages.length * PAGE : undefined),
  });
  const first = q.data?.pages[0];
  const holders = q.data?.pages.flatMap((p) => p.holders) ?? [];
  if (q.isLoading) return <div style={{ display: 'grid', gap: 14 }}><Skeleton h={96} r={14} /><Skeleton h={320} r={14} /></div>;
  if (!first || !holders.length) return <EmptyState title={t('holders.empty')} />;
  const s = first.summary;
  const me = address?.toLowerCase();

  return (
    <div className="holders">
      <div className="kpi-grid">
        <Kpi label={t('holders.count')} value={num(s.holders, lang)} />
        <Kpi label={t('holders.unique')} value={pctText(s.uniquePct)} hint={t('holders.uniqueHint')} />
        <Kpi label={t('holders.avg')} value={s.avgHeld.toFixed(s.avgHeld < 10 ? 2 : 1)} />
        <Kpi label={t('holders.top10')} value={pctText(s.top10Pct)} hint={t('holders.top10Hint')} />
      </div>

      <div className="holders__grid">
        <section className="chart-card">
          <header className="chart-card__head"><div><h3 className="h3">{t('holders.distribution')}</h3><div className="small muted">{t('holders.distributionSub')}</div></div></header>
          <HBars rows={s.distribution.map((d) => ({ label: t('holders.bucket', { n: d.label }), v: d.count }))} fmt={(v) => num(v, lang)} />
        </section>

        <section className="chart-card holders__list">
          <header className="chart-card__head">
            <div><h3 className="h3">{t('holders.title')}</h3><div className="small muted">{t('holders.pnlHint')}</div></div>
            <select className="select select--sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('col.sort')}>
              <option value="held">{t('holders.sortHeld')}</option>
              <option value="pnl">{t('holders.sortPnl')}</option>
              <option value="volume">{t('holders.sortVolume')}</option>
            </select>
          </header>
          <div className="holder-rows">
            {holders.map((h) => {
              const pnl = BigInt(h.pnl || '0');
              return (
                <div className={`holder-row ${h.owner === me ? 'is-me' : ''}`} key={h.owner}>
                  <span className="holder-row__rank mono-num">{h.rank}</span>
                  <Link to={`/profile/${h.owner}`} className="holder-row__who">
                    <Avatar address={h.owner} size={36} />
                    <span style={{ display: 'grid', minWidth: 0 }}>
                      <span className="strong ellipsis">{h.owner === me ? t('common.you') : h.username || short(h.owner)}</span>
                      <span className="tiny muted mono-num">{t('holders.items', { n: num(h.held, lang) })} · {pctText(h.share)}</span>
                    </span>
                  </Link>
                  <div className="holder-row__samples" aria-label={t('holders.samples')}>
                    {h.samples.slice(0, 5).map((x) => (
                      <Link key={x.token_id} to={`/item/${c.slug}/${x.token_id}`} className="holder-thumb" title={x.name || `#${x.token_id}`}>
                        <TokenArt collection={c} token={{ token_id: x.token_id, image_url: x.image_url }} />
                      </Link>
                    ))}
                    {h.held > 5 && <span className="holder-thumb holder-thumb--more small">+{num(h.held - 5, lang)}</span>}
                  </div>
                  <div className="holder-row__stats">
                    <Stat label={t('holders.minted')} value={num(h.minted, lang)} />
                    <Stat label={t('holders.bought')} value={num(h.bought, lang)} />
                    <Stat label={t('holders.sold')} value={num(h.sold, lang)} />
                    <Stat label={t('holders.spent')} value={money(h.spent)} />
                    <Stat label={t('holders.volume')} value={money(h.volume)} />
                    <Stat label={t('holders.pnl')} value={signed(h.pnl)} tone={pnl > 0n ? 'up' : pnl < 0n ? 'down' : undefined} />
                  </div>
                </div>
              );
            })}
          </div>
          {q.hasNextPage && (
            <div style={{ display: 'grid', placeItems: 'center', paddingTop: 12 }}>
              <button className="btn btn--outline btn--sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>{t('common.loadMore')}</button>
            </div>
          )}
        </section>
      </div>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <span className="mini-stat">
      <span className="mini-stat__label">{label}</span>
      <span className={`mini-stat__value mono-num ${tone || ''}`}>{value}</span>
    </span>
  );
}
