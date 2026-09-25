import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BRAND, GIWA_COWS } from '../config';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { blobPath, mulberry32 } from '../lib/art';
import { eth, num, timeAgo, tokenLabel } from '../lib/format';
import type { Activity, Collection, DropListItem } from '../lib/types';
import { CollectionAvatar, CowImage, SmartImage, TileArt, TokenArt } from '../components/Art';
import { DropCard, DropStatusPill, phasePrice } from '../components/DropCard';
import { Badge, CountdownLabel, EmptyState, Progress, Skeleton } from '../components/ui';

function HideField() {
  const blobs = useMemo(() => {
    const r = mulberry32(2222);
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

function FeaturedDrop({ d }: { d: DropListItem }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const c = d.collection;
  const phase = d.livePhase ?? d.nextPhase;
  return (
    <div className="feature-drop">
      <Link to={`/launchpad/${c.slug}`} className="feature-drop__media" aria-label={c.name}>
        <DropStatusPill d={d} />
        <CollectionAvatar collection={c} />
      </Link>
      <div className="feature-drop__body">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="small muted">{t('home.featured')}</div>
            <div className="row" style={{ gap: 6 }}><span className="h2">{c.name}</span><Badge official={c.is_official} verified={c.verified} size={18} /></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">{phase?.name}</div>
            <div className="h3 mono-num">{phasePrice(phase?.priceWei, t('lp.free'))}</div>
          </div>
        </div>
        <div>
          <Progress value={c.total_supply} max={c.max_supply || 1} />
          <div className="progress-meta">
            <span>{t('lp.minted', { n: num(c.total_supply, lang), max: num(c.max_supply, lang) })}</span>
            <span className="muted">
              {d.status === 'live' && d.livePhase?.end ? <CountdownLabel k="lp.endsIn" to={d.livePhase.end} /> : null}
              {d.status === 'upcoming' && d.nextPhase ? <CountdownLabel k="lp.startsIn" to={d.nextPhase.start} /> : null}
            </span>
          </div>
        </div>
        <button className="btn btn--lg btn--block" onClick={() => nav(`/launchpad/${c.slug}`)}>{t('home.mintNow')}</button>
      </div>
    </div>
  );
}

function CowsTeaser() {
  const { t } = useI18n();
  return (
    <Link to={`/${GIWA_COWS.slug}`} className="feature-drop" style={{ display: 'grid' }}>
      <div className="feature-drop__media"><span className="pill">{t('lp.upcoming')}</span><CowImage index={0} /></div>
      <div className="feature-drop__body">
        <div className="row" style={{ gap: 6 }}><span className="h2">{GIWA_COWS.name}</span><Badge official size={18} /></div>
        <p className="soft small">{t('cows.soonTitle')}</p>
        <span className="btn btn--lg btn--block">{t('cows.title')}</span>
      </div>
    </Link>
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

function LatestSales() {
  const { t, lang } = useI18n();
  const { data } = useQuery({ queryKey: ['activity', 'home-sales'], queryFn: () => api.get<{ activity: Activity[] }>('/activity', { types: 'sale', limit: 6 }) });
  return (
    <div className="panel">
      <div className="panel__head"><span>{t('home.latestSales')}</span><Link to="/activity" className="small link">{t('common.viewAll')}</Link></div>
      <div>
        {(data?.activity ?? []).map((a) => (
          <Link key={a.id} to={`/item/${a.collection_slug}/${a.token_id}`} className="row" style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)' }}>
            <span className="thumb thumb--sm" style={{ position: 'relative' }}>
              <TokenArt collection={{ address: a.collection, art_style: a.art_style }} token={{ token_id: a.token_id!, image_url: a.token_image, attributes: a.token_attributes }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="strong small" style={{ display: 'block' }}>{tokenLabel(a.token_name, a.token_id)}</span>
              <span className="tiny muted">{timeAgo(a.created_at, lang)}</span>
            </span>
            <span className="strong mono-num">{eth(a.price_wei)} ETH</span>
          </Link>
        ))}
        {!data && <div style={{ padding: 18 }}><Skeleton h={160} /></div>}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { data: drops } = useQuery({ queryKey: ['drops', 'all'], queryFn: () => api.get<{ drops: DropListItem[] }>('/drops') });
  const list = drops?.drops ?? [];
  const featured = list.find((d) => d.collection.slug === GIWA_COWS.slug && d.status !== 'ended') ?? list.find((d) => d.status === 'live') ?? list[0];
  const official = list.find((d) => d.collection.slug === GIWA_COWS.slug)?.collection;

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
          <div>{featured ? <FeaturedDrop d={featured} /> : drops ? <CowsTeaser /> : <Skeleton h={520} r={22} />}</div>
        </div>
      </section>

      <div className="container">
        <TrendingTable />

        <section className="section">
          <div className="section__head">
            <h2 className="h2">{t('home.drops')}</h2>
            <Link to="/launchpad" className="btn btn--outline btn--sm">{t('common.viewAll')}</Link>
          </div>
          {drops && list.length === 0 ? (
            <EmptyState title={t('lp.emptyLive')} action={<Link className="btn" to="/create">{t('lp.create')}</Link>} />
          ) : (
            <div className="drop-grid">{list.slice(0, 3).map((d) => <DropCard key={d.collection.address} d={d} />)}</div>
          )}
        </section>

        <section className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <LatestSales />
          {official && (
            <Link to={`/${GIWA_COWS.slug}`} className="panel" style={{ display: 'grid', gridTemplateRows: '180px auto' }}>
              <div style={{ overflow: 'hidden', position: 'relative' }}><SmartImage src={BRAND.websiteBanner} alt={GIWA_COWS.name} fallback={<TileArt seed="official" wide />} /></div>
              <div className="panel__body" style={{ display: 'grid', gap: 12 }}>
                <div className="row" style={{ gap: 8 }}><span className="pill pill--outline">{t('home.official')}</span></div>
                <div className="row" style={{ gap: 6 }}><span className="h2">{official.name}</span><Badge official size={18} /></div>
                <p className="soft">{t('home.officialBody')}</p>
                <div className="stats">
                  <div className="stat"><span className="stat__value">{official.floor_wei ? `${eth(official.floor_wei)} ETH` : '—'}</span><span className="stat__label">{t('common.floor')}</span></div>
                  <div className="stat"><span className="stat__value">{eth(official.volume_wei)} ETH</span><span className="stat__label">{t('common.volume')}</span></div>
                  <div className="stat"><span className="stat__value">{official.owners_count.toLocaleString()}</span><span className="stat__label">{t('common.owners')}</span></div>
                </div>
                <span className="btn btn--sm" style={{ justifySelf: 'start' }}>{t('home.viewCollection')}</span>
              </div>
            </Link>
          )}
        </section>
      </div>
    </>
  );
}
