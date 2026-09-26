import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GIWA_COWS } from '../config';
import { useI18n } from '../i18n';
import { SocialIcon } from '../components/Social';
import { api } from '../lib/api';
import { eth, num, pct, safeHref } from '../lib/format';
import type { Collection, DropState, Token, TraitGroup } from '../lib/types';
import { CollectionAvatar, CollectionBanner, CowImage, SmartImage, TileArt } from '../components/Art';
import { NftCard } from '../components/NftCard';
import { Badge, Skeleton } from '../components/ui';
import { ActivityTab } from './Collection';
import { MintBox, MintProgress, useDrop } from './Drop';

/** Dedicated GIWA COWS section: story, live mint, cheapest listings, traits and activity. */
export default function GiwaCows() {
  const { t } = useI18n();
  const col = useQuery({
    queryKey: ['collection', GIWA_COWS.slug],
    queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${GIWA_COWS.slug}`),
    retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
  const drop = useDrop(GIWA_COWS.slug);

  if (col.isLoading) return <div className="page container"><Skeleton h={420} r={22} /></div>;
  if (!col.data) return <ComingSoon />;
  const c = col.data.collection;
  const d = drop.data?.drop ?? col.data.drop;
  const mintOpen = d && (d.status === 'live' || d.status === 'upcoming');

  return (
    <>
      <section className="cows-hero">
        <div className="cows-hero__banner"><CollectionBanner collection={c} /></div>
        <div className="container cows-hero__inner">
          <div className="cows-hero__copy">
            <div className="cows-hero__avatar"><CollectionAvatar collection={c} /></div>
            <div className="row" style={{ gap: 10 }}><h1 className="display">{GIWA_COWS.name}</h1><Badge official size={30} /></div>
            <p className="lead">{c.description || t('cows.sub')}</p>
            <div className="stats">
              <Stat label={t('cows.supply')} value={num(c.max_supply ?? GIWA_COWS.supply)} />
              <Stat label={t('cows.minted')} value={num(c.total_supply)} />
              <Stat label={t('common.floor')} value={c.floor_wei ? `${eth(c.floor_wei)} ETH` : '—'} />
              <Stat label={t('common.owners')} value={num(c.owners_count)} />
              <Stat label={t('common.volume')} value={`${eth(c.volume_wei)} ETH`} />
            </div>
            <div className="hero__ctas">
              <Link to={`/collection/${c.slug}`} className="btn btn--lg">{t('cows.trade')}</Link>
              {mintOpen && <Link to={`/launchpad/${c.slug}`} className="btn btn--lg btn--outline">{t('cows.viewDrop')}</Link>}
              {(c.twitter || GIWA_COWS.x) && (
                <a className="btn btn--lg btn--ghost" href={safeHref(c.twitter) || safeHref(GIWA_COWS.x)} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={15} />{t('cows.follow')}</a>
              )}
            </div>
          </div>
          {mintOpen && d && drop.data && (
            <div className="cows-hero__mint">
              <MintProgress c={drop.data.collection} />
              <MintBox c={drop.data.collection} drop={d} />
            </div>
          )}
        </div>
      </section>

      <div className="container">
        <Pillars />
        <Gallery />
        <Listings c={c} />
        <Traits c={c} />
        <section className="section">
          <h2 className="h2" style={{ marginBottom: 18 }}>{t('cows.activity')}</h2>
          <ActivityTab collection={c.address} />
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span className="stat__value mono-num">{value}</span><span className="stat__label">{label}</span></div>;
}

function Pillars() {
  const { t } = useI18n();
  const items = [
    { id: 1, title: t('cows.hand'), body: t('cows.handBody') },
    { id: 4, title: t('cows.fair'), body: t('cows.fairBody') },
    { id: 7, title: t('cows.home'), body: t('cows.homeBody') },
  ];
  return (
    <section className="section cows-pillars">
      {items.map((p) => (
        <div key={p.id} className="cows-pillar">
          <div className="cows-pillar__art"><CowImage index={p.id} /></div>
          <div>
            <h3 className="h3">{p.title}</h3>
            <p className="soft small" style={{ marginTop: 6 }}>{p.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** The official GIWA COWS artwork. */
function Gallery() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="section">
      <h2 className="h2" style={{ marginBottom: 18 }}>{t('cows.gallery')}</h2>
      <div className="cows-gallery">
        {GIWA_COWS.images.map((src, i) => (
          <button key={src} type="button" className="cows-gallery__item" onClick={() => setOpen(i)} aria-label={`${GIWA_COWS.name} ${i + 1}`}>
            <CowImage index={i} />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <img src={GIWA_COWS.images[open]} alt={`${GIWA_COWS.name} ${open + 1}`} />
        </div>
      )}
    </section>
  );
}

function Listings({ c }: { c: Collection }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ['tokens', c.address, 'cows-floor'],
    queryFn: () => api.get<{ tokens: Token[] }>(`/collections/${c.address}/tokens`, { status: 'listed', sort: 'price_asc', limit: 8 }),
  });
  const tokens = q.data?.tokens ?? [];
  if (!q.isLoading && tokens.length === 0) return null;
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="h2">{t('cows.floorListings')}</h2>
        <Link to={`/collection/${c.slug}`} className="btn btn--outline btn--sm">{t('common.viewAll')}</Link>
      </div>
      <div className="nft-grid">{tokens.map((tok) => <NftCard key={tok.token_id} token={tok} collection={c} />)}</div>
    </section>
  );
}

function Traits({ c }: { c: Collection }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['traits', c.address], queryFn: () => api.get<{ traits: TraitGroup[]; total: number }>(`/collections/${c.address}/traits`) });
  const groups = q.data?.traits ?? [];
  return (
    <section className="section">
      <h2 className="h2" style={{ marginBottom: 18 }}>{t('cows.traits')}</h2>
      {groups.length === 0 ? (
        <p className="soft">{t('cows.traitsEmpty')}</p>
      ) : (
        <div className="cows-traits">
          {groups.map((g) => (
            <div key={g.trait_type} className="card card--pad">
              <div className="strong" style={{ marginBottom: 10 }}>{g.trait_type}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {g.values.slice(0, 6).map((v) => (
                  <div key={v.value} className="row small" style={{ justifyContent: 'space-between' }}>
                    <span>{v.value}</span>
                    <span className="muted mono-num">{pct(v.count, q.data?.total || 1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ComingSoon() {
  const { t } = useI18n();
  return (
    <>
      <section className="cows-hero">
        <div className="cows-hero__banner"><SmartImage src={GIWA_COWS.banner} alt={GIWA_COWS.name} fallback={<TileArt seed="giwa-cows" wide />} /></div>
        <div className="container cows-hero__inner">
          <div className="cows-hero__copy">
            <div className="cows-hero__avatar"><SmartImage src={GIWA_COWS.logo} alt={GIWA_COWS.name} fallback={<TileArt seed="giwa-cows" />} /></div>
            <h1 className="display">{GIWA_COWS.name}</h1>
            <p className="lead">{t('cows.sub')}</p>
            <div className="stats">
              <Stat label={t('cows.supply')} value={num(GIWA_COWS.supply)} />
              <Stat label={t('cows.chain')} value="GIWA" />
            </div>
            <div className="notice" style={{ maxWidth: 560 }}>
              <span><strong>{t('cows.soonTitle')}</strong><br />{t('cows.soonBody')}</span>
            </div>
            <div className="hero__ctas">
              <Link to="/explore" className="btn btn--lg">{t('home.explore')}</Link>
              {GIWA_COWS.x && <a className="btn btn--lg btn--outline" href={GIWA_COWS.x} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={15} />{t('cows.follow')}</a>}
            </div>
          </div>
          <div className="cows-preview">
            {[0, 5, 9, 13].map((i) => <div key={i} style={{ position: 'relative' }}><CowImage index={i} /></div>)}
          </div>
        </div>
      </section>
      <div className="container"><Pillars /><Gallery /></div>
    </>
  );
}
