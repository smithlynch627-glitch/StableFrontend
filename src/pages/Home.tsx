import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GIWA_COWS } from '../config';
import { useI18n } from '../i18n';
import { cowsContent } from '../content/cows';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { blobPath, mulberry32 } from '../lib/art';
import { useMoney } from '../lib/currency';
import { eth, num, short, timeAgo, tokenLabel } from '../lib/format';
import type { Activity, Collection, DropListItem } from '../lib/types';
import { CollectionAvatar, TokenArt } from '../components/Art';
import { CollectionCard } from '../components/CollectionCard';
import { DropCard, DropStatusPill } from '../components/DropCard';
import { FaqSection } from '../components/Faq';
import { IconArrowRight, IconExternal, IconVerified } from '../components/Icons';
import { CowRotator } from '../components/cows';
import { Badge, CountdownLabel, EmptyState, Progress, Skeleton } from '../components/ui';

function HideField() {
  const blobs = useMemo(() => {
    const r = mulberry32(3333);
    return [
      blobPath(8, 20, 14, r, 8, 0.6), blobPath(88, 12, 11, r, 8, 0.6), blobPath(64, 82, 16, r, 8, 0.6),
      blobPath(30, 92, 9, r, 7, 0.6), blobPath(52, 40, 7, r, 7, 0.6),
    ];
  }, []);
  return (
    <div className="hero__hide" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {blobs.map((d, i) => <path key={i} d={d} className="hide-blob" />)}
      </svg>
    </div>
  );
}

/** The hero card: GIWA COWS only, with artwork that changes every few seconds. */
function CowsCard({ drop }: { drop?: DropListItem }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const copy = cowsContent(lang);
  const c = drop?.collection;
  const minting = !!drop && (drop.status === 'live' || drop.status === 'upcoming');
  return (
    <div className="cows-card">
      <Link to={`/${GIWA_COWS.slug}`} className="cows-card__media" aria-label={GIWA_COWS.name}>
        <CowRotator interval={3200} w={720} />
        <span className="cows-card__pill"><IconVerified size={14} official />{t('home.officialPill')}</span>
        {minting && drop && <span className="cows-card__status"><DropStatusPill d={drop} /></span>}
      </Link>
      <div className="cows-card__body">
        <div>
          <div className="tiny muted">{copy.eyebrow}</div>
          <div className="row" style={{ gap: 6 }}><span className="h2">{GIWA_COWS.name}</span><Badge official size={20} /></div>
        </div>
        {minting && c ? (
          <div>
            <Progress value={c.total_supply} max={c.max_supply || 1} />
            <div className="progress-meta">
              <span>{t('lp.minted', { n: num(c.total_supply, lang), max: num(c.max_supply, lang) })}</span>
              <span className="muted">
                {drop.status === 'live' && drop.livePhase?.end ? <CountdownLabel k="lp.endsIn" to={drop.livePhase.end} /> : null}
                {drop.status === 'upcoming' && drop.nextPhase ? <CountdownLabel k="lp.startsIn" to={drop.nextPhase.start} /> : null}
              </span>
            </div>
          </div>
        ) : (
          <dl className="cows-card__facts">
            {copy.facts.slice(0, 3).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
          </dl>
        )}
        {minting ? (
          <button className="btn btn--lg btn--block" onClick={() => nav(`/launchpad/${GIWA_COWS.slug}`)}>{t('home.mintNow')}</button>
        ) : (
          <Link to={`/${GIWA_COWS.slug}`} className="btn btn--lg btn--block">{t('home.cowsCta')}<IconArrowRight size={16} /></Link>
        )}
      </div>
    </div>
  );
}

/** Collections the team marked as featured. The whole section is hidden when there are none. */
function FeaturedCollections() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ['collections', 'featured'],
    queryFn: () => api.get<{ collections: Collection[] }>('/collections', { featured: 1, sort: 'volume', limit: 8 }),
  });
  const list = (q.data?.collections ?? []).filter((c) => c.slug !== GIWA_COWS.slug);
  if (list.length === 0) return null;
  return (
    <section className="section">
      <div className="section__head">
        <div className="section__title">
          <h2 className="h2">{t('home.featuredCols')}</h2>
          <p className="small muted">{t('home.featuredSub')}</p>
        </div>
        <Link to="/explore" className="btn btn--outline btn--sm">{t('common.viewAll')}</Link>
      </div>
      <div className="drop-grid">{list.map((c) => <CollectionCard key={c.address} c={c} featured />)}</div>
    </section>
  );
}

function Launchpad({ drops, loading }: { drops: DropListItem[]; loading: boolean }) {
  const { t } = useI18n();
  const rank = { live: 0, upcoming: 1, sold_out: 2, ended: 3 } as Record<string, number>;
  const list = [...drops].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9)).slice(0, 6);
  return (
    <section className="section">
      <div className="section__head">
        <div className="section__title">
          <h2 className="h2">{t('home.drops')}</h2>
          <p className="small muted">{t('home.dropsSub')}</p>
        </div>
        <Link to="/launchpad" className="btn btn--outline btn--sm">{t('common.viewAll')}</Link>
      </div>
      {loading ? (
        <div className="drop-grid">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={320} r={14} />)}</div>
      ) : list.length === 0 ? (
        <EmptyState title={t('lp.emptyLive')} action={<Link className="btn" to="/create">{t('lp.create')}</Link>} />
      ) : (
        <div className="drop-grid">{list.map((d) => <DropCard key={d.collection.address} d={d} />)}</div>
      )}
    </section>
  );
}

function Party({ a, label }: { a: string | null; label: string }) {
  if (!a) return <span className="muted">—</span>;
  return <Link className="sale-card__addr" to={`/profile/${a}`} title={`${label}: ${a}`}><span className="muted">{label}</span> {short(a)}</Link>;
}

function SaleCard({ a }: { a: Activity }) {
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const { usd } = useMoney();
  const col = { address: a.collection, art_style: a.art_style, image_url: a.collection_image, name: a.collection_name };
  const itemUrl = a.token_id ? `/item/${a.collection_slug}/${a.token_id}` : `/collection/${a.collection_slug}`;
  const usdPrice = a.price_wei ? usd(a.price_wei) : null;
  return (
    <article className="sale-card">
      <Link to={itemUrl} className="sale-card__media" aria-label={tokenLabel(a.token_name, a.token_id)}>
        {a.token_id
          ? <TokenArt collection={col} token={{ token_id: a.token_id, image_url: a.token_image, attributes: a.token_attributes }} />
          : <CollectionAvatar collection={col} />}
      </Link>
      <div className="sale-card__main">
        <Link to={itemUrl} className="sale-card__name">{tokenLabel(a.token_name, a.token_id)}</Link>
        <Link to={`/collection/${a.collection_slug}`} className="sale-card__col">{a.collection_name}</Link>
      </div>
      <div className="sale-card__price">
        <span className="mono-num">{eth(a.price_wei)} ETH</span>
        {usdPrice && <span className="tiny muted mono-num">≈ {usdPrice}</span>}
      </div>
      <div className="sale-card__foot">
        <span className="sale-card__parties">
          <Party a={a.from_addr} label={t('home.seller')} />
          <IconArrowRight size={12} />
          <Party a={a.to_addr} label={t('home.buyer')} />
        </span>
        {a.tx_hash ? (
          <a className="sale-card__time link" href={`${cfg.explorerUrl}/tx/${a.tx_hash}`} target="_blank" rel="noreferrer" title={t('home.viewTx')}>
            {timeAgo(a.created_at, lang)}<IconExternal size={12} />
          </a>
        ) : (
          <span className="sale-card__time muted">{timeAgo(a.created_at, lang)}</span>
        )}
      </div>
    </article>
  );
}

function LatestSales() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ['activity', 'home-sales'],
    queryFn: () => api.get<{ activity: Activity[] }>('/activity', { types: 'sale', limit: 9 }),
    refetchInterval: 30_000,
  });
  const list = q.data?.activity ?? [];
  return (
    <section className="section">
      <div className="section__head">
        <div className="section__title">
          <h2 className="h2">{t('home.latestSales')}</h2>
          <p className="small muted">{t('home.salesSub')}</p>
        </div>
        <Link to="/activity" className="btn btn--outline btn--sm">{t('common.viewAll')}</Link>
      </div>
      {q.isLoading ? (
        <div className="sales-grid">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={118} r={16} />)}</div>
      ) : list.length === 0 ? (
        <EmptyState title={t('home.noSales')} action={<Link className="btn btn--outline" to="/explore">{t('home.explore')}</Link>} />
      ) : (
        <div className="sales-grid">{list.map((a) => <SaleCard key={a.id} a={a} />)}</div>
      )}
    </section>
  );
}

function TrendingTable() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [range, setRange] = useState<'24h' | 'all'>('24h');
  const { data, isLoading } = useQuery({
    queryKey: ['collections', range],
    queryFn: () => api.get<{ collections: Collection[] }>('/collections', { sort: range === '24h' ? 'volume_24h' : 'volume', limit: 10 }),
  });
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="h2">{t('home.trending')}</h2>
        <div className="row">
          <div className="segmented">
            <button aria-pressed={range === '24h'} onClick={() => setRange('24h')}>{t('home.tab24h')}</button>
            <button aria-pressed={range === 'all'} onClick={() => setRange('all')}>{t('home.tabAll')}</button>
          </div>
          <Link to="/explore" className="btn btn--outline btn--sm hide-sm">{t('common.viewAll')}</Link>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="rank-num">#</th>
              <th>{t('common.collection')}</th>
              <th className="num">{t('common.floor')}</th>
              <th className="num">{range === '24h' ? t('common.volume24h') : t('common.volume')}</th>
              <th className="num hide-md">{t('common.sales')}</th>
              <th className="num hide-md">{t('common.owners')}</th>
              <th className="num hide-sm">{t('common.listed')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={7}><Skeleton h={36} /></td></tr>)}
            {!isLoading && data?.collections.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>{t('explore.empty')}</td></tr>}
            {data?.collections.map((c, i) => (
              <tr key={c.address} className="clickable" onClick={() => nav(`/collection/${c.slug}`)}>
                <td className="rank-num">{i + 1}</td>
                <td>
                  <Link to={`/collection/${c.slug}`} className="cell-item" onClick={(e) => e.stopPropagation()}>
                    <span className="thumb" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></span>
                    <span className="strong">{c.name}</span>
                    <Badge official={c.is_official} verified={c.verified} />
                  </Link>
                </td>
                <td className="num strong">{c.floor_wei ? `${eth(c.floor_wei)} ETH` : '—'}</td>
                <td className="num">{eth(range === '24h' ? c.volume_24h_wei : c.volume_wei)} ETH</td>
                <td className="num hide-md">{num(c.sales_count, lang)}</td>
                <td className="num hide-md">{num(c.owners_count, lang)}</td>
                <td className="num hide-sm">{c.total_supply ? `${((c.listed_count / c.total_supply) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { data: drops, isLoading } = useQuery({ queryKey: ['drops', 'all'], queryFn: () => api.get<{ drops: DropListItem[] }>('/drops') });
  const list = drops?.drops ?? [];
  const cowsDrop = list.find((d) => d.collection.slug === GIWA_COWS.slug);

  return (
    <>
      <section className="hero">
        <HideField />
        <div className="container hero__inner">
          <div className="hero__copy">
            <h1 className="display">{t('home.title')}</h1>
            <p className="lead">{t('home.sub')}</p>
            <div className="hero__ctas">
              <Link to="/explore" className="btn btn--lg">{t('home.explore')}</Link>
              <Link to="/create" className="btn btn--lg btn--outline">{t('home.launch')}</Link>
            </div>
          </div>
          <div><CowsCard drop={cowsDrop} /></div>
        </div>
      </section>

      <div className="container">
        <FeaturedCollections />
        <Launchpad drops={list} loading={isLoading} />
        <LatestSales />
        <TrendingTable />
        <FaqSection only={['marketplace', 'launchpad']} />
      </div>
    </>
  );
}
