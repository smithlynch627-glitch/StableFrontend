// Analytics: volume, sales, floor, price history, top sales and the rarest listed items for one collection.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { dateTime, num, short, shortId, timeAgo, tokenLabel } from '../../lib/format';
import { usdText, useMoney } from '../../lib/currency';
import type { Analytics, AnalyticsRange, Collection } from '../../lib/types';
import { TokenArt } from '../Art';
import { ChartCard, ColumnChart, LineChart, ScatterChart, type Point } from '../Charts';
import { EmptyState, Skeleton } from '../ui';
import { Kpi } from './HoldersTab';

const RANGES: AnalyticsRange[] = ['24h', '7d', '30d', 'all'];
const BUCKET_MS: Record<AnalyticsRange, number> = { '24h': 3600e3, '7d': 6 * 3600e3, '30d': 86400e3, all: 86400e3 };
const SPAN_MS: Record<AnalyticsRange, number> = { '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3, all: 0 };
const toEth = (wei: string | null | undefined) => (wei ? Number(formatEther(BigInt(wei))) : 0);

export function AnalyticsTab({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
  const { money, isUsd, rate } = useMoney();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const q = useQuery({
    queryKey: ['analytics', c.address, range],
    queryFn: () => api.get<Analytics>(`/collections/${c.address}/analytics`, { range }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const a = q.data;

  // Chart values are plotted in the selected currency.
  const conv = (ethValue: number) => (isUsd && rate ? ethValue * rate : ethValue);
  const fmtV = (v: number) => (isUsd && rate ? usdText(v) : `${compactEth(v)}`);
  const fmtT = (ts: number) =>
    new Date(ts).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', range === '24h' ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' });

  const now = Date.now();
  const t1 = now;
  const t0 = useMemo(() => {
    if (!a) return now - 7 * 86400e3;
    if (range !== 'all') return now - SPAN_MS[range];
    const first = [...a.series.map((s) => +new Date(s.t)), ...a.floor.map((f) => +new Date(f.t)), ...a.sales.map((s) => +new Date(s.t))];
    return first.length ? Math.min(...first) : now - 30 * 86400e3;
  }, [a, range]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume per bucket, with empty buckets filled in so gaps read as "no sales".
  const volume: (Point & { sales: number })[] = useMemo(() => {
    if (!a) return [];
    const step = BUCKET_MS[range];
    const by = new Map(a.series.map((s) => [Math.floor(+new Date(s.t) / step) * step, s]));
    const out: (Point & { sales: number })[] = [];
    const maxBuckets = 180;
    let start = Math.floor(t0 / step) * step;
    if ((t1 - start) / step > maxBuckets) start = t1 - maxBuckets * step;
    for (let k = start; k <= t1; k += step) {
      const s = by.get(Math.floor(k / step) * step);
      out.push({ t: k, v: conv(toEth(s?.volume)), sales: s?.sales ?? 0 });
    }
    return out;
  }, [a, range, isUsd, rate, t0]); // eslint-disable-line react-hooks/exhaustive-deps

  const sales: Point[] = useMemo(() => (a?.sales ?? []).map((s) => ({ t: +new Date(s.t), v: conv(toEth(s.price)), label: s.token_id })), [a, isUsd, rate]); // eslint-disable-line react-hooks/exhaustive-deps
  const floor: Point[] = useMemo(() => (a?.floor ?? []).filter((f) => f.floor).map((f) => ({ t: +new Date(f.t), v: conv(toEth(f.floor)) })), [a, isUsd, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return <div style={{ display: 'grid', gap: 14 }}><Skeleton h={48} r={12} /><Skeleton h={110} r={14} /><Skeleton h={300} r={14} /></div>;

  const delta = (cur: number, prev: number | null | undefined) => {
    if (prev === null || prev === undefined || !a.previous) return null;
    if (prev === 0) return cur > 0 ? { text: t('an.new'), up: true } : null;
    const d = ((cur - prev) / prev) * 100;
    return { text: `${Math.abs(d).toFixed(d > 100 ? 0 : 1)}% ${t('an.vsPrev')}`, up: d >= 0 };
  };
  const labels = { chart: t('an.chart'), table: t('an.table') };

  return (
    <div className={`analytics ${q.isFetching ? 'is-refreshing' : ''}`}>
      <div className="analytics__filters">
        <div className="segmented" role="group" aria-label={t('an.range')}>
          {RANGES.map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{t(`an.range.${r}` as never)}</button>)}
        </div>
        <span className="small muted">{t('an.updated')}</span>
      </div>

      <div className="kpi-grid kpi-grid--wide">
        <Kpi label={t('an.volume')} value={money(a.totals.volume)} delta={delta(toEth(a.totals.volume), a.previous ? toEth(a.previous.volume) : null)} />
        <Kpi label={t('an.sales')} value={num(a.totals.sales, lang)} delta={delta(a.totals.sales, a.previous?.sales)} />
        <Kpi label={t('an.avg')} value={a.totals.avg ? money(a.totals.avg) : '—'} />
        <Kpi label={t('common.floor')} value={a.totals.floor ? `${compactEth(toEth(a.totals.floor))} ETH` : '—'} />
        <Kpi label={t('common.bestOffer')} value={a.totals.bestOffer ? money(a.totals.bestOffer, 'WETH') : '—'} />
        <Kpi label={t('an.highest')} value={a.totals.max ? money(a.totals.max) : '—'} />
        <Kpi label={t('common.owners')} value={num(a.totals.owners, lang)} />
        <Kpi label={t('an.listed')} value={a.totals.supply ? `${((a.totals.listed / a.totals.supply) * 100).toFixed(1)}%` : '—'} />
      </div>

      <ChartCard
        title={t('an.priceHistory')}
        sub={t('an.priceHistorySub', { n: num(a.sales.length, lang) })}
        empty={!sales.length}
        emptyText={t('an.noSales')}
        tableLabel={labels.table}
        chartLabel={labels.chart}
        table={{ head: [t('an.time'), t('common.item'), t('common.price')], rows: [...(a.sales ?? [])].reverse().slice(0, 200).map((s) => [dateTime(s.t, lang), `#${shortId(s.token_id)}`, money(s.price)]) }}
      >
        <ScatterChart data={sales} t0={t0} t1={t1} fmt={fmtV} fmtT={fmtT}
          tip={(p) => (<><strong>{fmtV(p.v)}</strong><span>#{shortId(p.label)}</span><span className="muted">{dateTime(new Date(p.t), lang)}</span></>)} />
      </ChartCard>

      <div className="analytics__row">
        <ChartCard
          title={t('an.volumeChart')}
          sub={isUsd ? 'USD' : 'ETH'}
          empty={!a.series.length}
          emptyText={t('an.noSales')}
          tableLabel={labels.table}
          chartLabel={labels.chart}
          table={{ head: [t('an.time'), t('an.volume'), t('an.sales')], rows: volume.filter((v) => v.sales).reverse().map((v) => [fmtT(v.t), fmtV(v.v), num(v.sales, lang)]) }}
        >
          <ColumnChart data={volume} fmt={fmtV} fmtT={fmtT}
            tip={(p) => (<><strong>{fmtV(p.v)}</strong><span>{t('an.salesN', { n: (p as Point & { sales: number }).sales })}</span><span className="muted">{fmtT(p.t)}</span></>)} />
        </ChartCard>
        <ChartCard
          title={t('an.floorChart')}
          sub={isUsd ? 'USD' : 'ETH'}
          empty={floor.length < 2}
          emptyText={t('an.noFloor')}
          tableLabel={labels.table}
          chartLabel={labels.chart}
          table={{ head: [t('an.time'), t('common.floor')], rows: [...floor].reverse().map((f) => [fmtT(f.t), fmtV(f.v)]) }}
        >
          <LineChart data={floor} fmt={fmtV} fmtT={fmtT} t0={t0} t1={t1}
            tip={(p) => (<><strong>{fmtV(p.v)}</strong><span className="muted">{dateTime(new Date(p.t), lang)}</span></>)} />
        </ChartCard>
      </div>

      <div className="analytics__row">
        <section className="chart-card">
          <header className="chart-card__head"><div><h3 className="h3">{t('an.topSales')}</h3><div className="small muted">{t(`an.range.${range}` as never)}</div></div></header>
          {a.topSales.length === 0 ? <div className="chart-card__empty small muted">{t('an.noSales')}</div> : (
            <ol className="rank-list">
              {a.topSales.map((s, i) => (
                <li key={`${s.tx_hash}-${s.token_id}`}>
                  <span className="rank-list__n mono-num">{i + 1}</span>
                  <Link to={`/item/${c.slug}/${s.token_id}`} className="rank-list__thumb"><TokenArt collection={c} token={{ token_id: s.token_id, image_url: s.image_url }} /></Link>
                  <span className="rank-list__main">
                    <Link to={`/item/${c.slug}/${s.token_id}`} className="strong ellipsis">{tokenLabel(s.name, s.token_id)}</Link>
                    <span className="tiny muted">{timeAgo(s.created_at, lang)} · {short(s.from_addr)} → {short(s.to_addr)}</span>
                  </span>
                  <span className="strong mono-num">{money(s.price_wei)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="chart-card">
          <header className="chart-card__head"><div><h3 className="h3">{t('an.rareListed')}</h3><div className="small muted">{t('an.rareListedSub')}</div></div></header>
          {a.rareListed.length === 0 ? <div className="chart-card__empty small muted">{t('an.noRare')}</div> : (
            <div className="rare-grid">
              {a.rareListed.map((x) => (
                <Link key={x.token_id} to={`/item/${c.slug}/${x.token_id}`} className="rare-card">
                  <span className="rare-card__img"><TokenArt collection={c} token={{ token_id: x.token_id, image_url: x.image_url }} /><span className="rare-card__rank">#{x.rarity_rank}</span></span>
                  <span className="strong small ellipsis">{tokenLabel(x.name, x.token_id)}</span>
                  <span className="small mono-num">{money(x.price_wei)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="kpi-grid">
        <Kpi label={t('an.minted')} value={num(a.mint.minted, lang)} />
        <Kpi label={t('an.minters')} value={num(a.mint.minters, lang)} />
        <Kpi label={t('an.buyers')} value={num(a.totals.buyers, lang)} />
        <Kpi label={t('an.sellers')} value={num(a.totals.sellers, lang)} />
      </div>
      {a.totals.sales === 0 && a.series.length === 0 && range !== 'all' && (
        <EmptyState title={t('an.quiet')} action={<button className="btn btn--outline btn--sm" onClick={() => setRange('all')}>{t('an.range.all')}</button>} />
      )}
    </div>
  );
}

/** Short ETH numbers for axes: 12.5, 0.042, 0.00031. */
function compactEth(v: number) {
  if (v === 0) return '0';
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (v >= 1) return String(Number(v.toFixed(2)));
  return String(Number(v.toPrecision(2)));
}
