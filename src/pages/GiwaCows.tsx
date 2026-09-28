import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GIWA_COWS } from '../config';
import { useI18n } from '../i18n';
import { cowsContent, COWS_SUPPLY, type CowsContent, type RoadmapPhase } from '../content/cows';
import { SocialIcon } from '../components/Social';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { eth, num, pct, safeHref } from '../lib/format';
import type { Collection, DropState, Token, TraitGroup } from '../lib/types';
import { NftCard } from '../components/NftCard';
import { fixImageUrl } from '../components/Art';
import { IconVerified, IconArrowRight, IconCheck, IconLock } from '../components/Icons';
import { Accordion } from '../components/Faq';
import {
  AnimatedTitle, CountUp, CowArt, CowDeck, CowLightbox, CowMarquee, Reveal, Scramble, cowIndex, useInView,
} from '../components/cows';
import { ActivityTab } from './Collection';
import { MintBox, MintProgress, useDrop } from './Drop';

type SectionId = 'overview' | 'market' | 'utility' | 'arts' | 'roadmap' | 'faq';

/** GIWA COWS, the official collection of StableMarket: story, facts, utility, art, roadmap and FAQ. */
export default function GiwaCows() {
  const { t, lang } = useI18n();
  const copy = cowsContent(lang);
  const { socials, ipfsGateway } = useAppConfig();
  const col = useQuery({
    queryKey: ['collection', GIWA_COWS.slug],
    queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${GIWA_COWS.slug}`),
    retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
  const drop = useDrop(GIWA_COWS.slug);
  const c = col.data?.collection ?? null;
  const d = drop.data?.drop ?? col.data?.drop ?? null;
  const mintOpen = !!d && !!drop.data && (d.status === 'live' || d.status === 'upcoming');
  const xUrl = safeHref(c?.twitter) || safeHref(GIWA_COWS.x) || safeHref(socials?.x) || '';
  const [art, setArt] = useState<number | null>(null);
  const close = useCallback(() => setArt(null), []);

  const sections: { id: SectionId; label: string }[] = [
    { id: 'overview', label: copy.nav.overview },
    ...(c ? [{ id: 'market' as const, label: copy.nav.market }] : []),
    { id: 'utility', label: copy.nav.utility },
    { id: 'arts', label: copy.nav.arts },
    { id: 'roadmap', label: copy.nav.roadmap },
    { id: 'faq', label: copy.nav.faq },
  ];

  return (
    <div className="cows-page">
      <section className="cows-stage cows-hero2">
        <div className="cows-hero2__bg" aria-hidden="true">
          <img src={fixImageUrl(GIWA_COWS.banner, ipfsGateway)} alt="" className="cows-hero2__banner" />
          <span className="cows-glow cows-glow--a" />
          <span className="cows-glow cows-glow--b" />
          <span className="cows-grid" />
        </div>
        <div className="container cows-hero2__inner">
          <div className="cows-hero2__copy">
            <span className="cows-eyebrow"><IconVerified size={18} official />{copy.eyebrow}</span>
            <AnimatedTitle text={GIWA_COWS.name} className="cows-title" />
            <p className="cows-hero2__lead">{copy.lead}</p>
            <dl className="cows-chips">
              {copy.facts.slice(0, 3).map((f, i) => (
                <div key={f.label} className="cows-chip" style={{ '--d': `${900 + i * 120}ms` } as CSSProperties}>
                  <dt>{f.label}</dt><dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="hero__ctas cows-hero2__ctas">
              {mintOpen && <Link to={`/launchpad/${GIWA_COWS.slug}`} className="btn btn--lg btn--gold">{t('cows.viewDrop')}</Link>}
              {xUrl && <a className={`btn btn--lg ${mintOpen ? 'btn--outline' : ''}`} href={xUrl} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={15} />{t('cows.follow')}</a>}
              {c && <Link to={`/collection/${c.slug}`} className="btn btn--lg btn--outline">{t('cows.trade')}</Link>}
              <a href="#roadmap" className={`btn btn--lg ${xUrl || c || mintOpen ? 'btn--ghost' : ''}`} onClick={(e) => { e.preventDefault(); jump('roadmap'); }}>{t('cows.roadmapCta')}<IconArrowRight size={16} /></a>
            </div>
            {c && c.total_supply > 0 && (
              <div className="stats cows-hero2__stats">
                <Stat label={t('cows.minted')} value={num(c.total_supply, lang)} />
                <Stat label={t('common.floor')} value={c.floor_wei ? `${eth(c.floor_wei)} ETH` : '—'} />
                <Stat label={t('common.owners')} value={num(c.owners_count, lang)} />
                <Stat label={t('common.volume')} value={`${eth(c.volume_wei)} ETH`} />
              </div>
            )}
          </div>
          <div className="cows-hero2__side">
            {mintOpen && d && drop.data ? (
              <div className="cows-hero2__mint">
                <MintProgress c={drop.data.collection} />
                <MintBox c={drop.data.collection} drop={d} />
              </div>
            ) : (
              <CowDeck labels={{ prev: t('cows.prevArt'), next: t('cows.nextArt') }} />
            )}
          </div>
        </div>
        <Ticker words={copy.ticker} />
      </section>

      <SectionNav sections={sections} label={t('cows.sectionNav')} />

      <div className="container">
        <Overview copy={copy} />
        {c && <Market c={c} copy={copy} />}
        <Utility copy={copy} />
      </div>

      <Arts copy={copy} onOpen={setArt} />

      <div className="container">
        <Roadmap copy={copy} />
        <CowsFaq copy={copy} xUrl={xUrl} />
        <Join copy={copy} xUrl={xUrl} />
      </div>

      {art !== null && (
        <CowLightbox index={art} onClose={close} onMove={setArt} labels={{ prev: t('cows.prevArt'), next: t('cows.nextArt'), close: t('common.close') }} />
      )}
    </div>
  );
}

function jump(id: SectionId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span className="stat__value mono-num">{value}</span><span className="stat__label">{label}</span></div>;
}

function Ticker({ words }: { words: string[] }) {
  const row = [...words, ...words];
  return (
    <div className="cows-ticker" aria-hidden="true">
      <div className="cows-ticker__track">
        {[0, 1].map((k) => (
          <span key={k} className="cows-ticker__group">
            {row.map((w, i) => <span key={i} className="cows-ticker__item">{w}<span className="cows-ticker__star">✦</span></span>)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Sticky section tabs that follow the scroll position. */
function SectionNav({ sections, label }: { sections: { id: SectionId; label: string }[]; label: string }) {
  const [active, setActive] = useState<SectionId>('overview');
  const ids = sections.map((s) => s.id).join(',');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = ids.split(',').map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id as SectionId);
    }, { rootMargin: '-35% 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  useEffect(() => {
    const id = window.location.hash.slice(1) as SectionId;
    if (id && ids.split(',').includes(id)) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 150);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <nav className="cows-nav" aria-label={label}>
      <div className="container cows-nav__inner">
        <span className="cows-nav__brand"><IconVerified size={16} official />{GIWA_COWS.name}</span>
        <div className="cows-nav__links">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'is-active' : ''} aria-current={active === s.id ? 'true' : undefined}
              onClick={(e) => { e.preventDefault(); setActive(s.id); jump(s.id); }}>
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function Overview({ copy }: { copy: CowsContent }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <section id="overview" className="cows-section">
      <div ref={ref} className="cows-facts">
        {copy.facts.map((f, i) => (
          <Reveal key={f.label} delay={i * 90} className={`cows-fact${i === 0 ? ' cows-fact--lead' : ''}`}>
            <span className="cows-fact__label">{f.label}</span>
            <span className="cows-fact__value mono-num">
              {i === 0 ? <CountUp to={COWS_SUPPLY} active={inView} /> : f.value}
              {i === 3 && <IconVerified size={30} official />}
            </span>
            <span className="cows-fact__note">{f.note}</span>
          </Reveal>
        ))}
      </div>

      <div className="cows-about">
        <Reveal className="cows-about__head">
          <span className="kicker">{GIWA_COWS.name}</span>
          <h2 className="h1">{copy.aboutTitle}</h2>
          <p className="lead">{copy.aboutLead}</p>
        </Reveal>
        <div className="cows-pillars2">
          {copy.pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 80} className="cows-pillar2">
              <div className="cows-pillar2__art"><CowArt index={i * 4 + 1} w={200} /></div>
              <span className="cows-pillar2__num mono-num">0{i + 1}</span>
              <h3 className="h3">{p.title}</h3>
              <p className="soft small">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Utility({ copy }: { copy: CowsContent }) {
  const [ref, inView] = useInView<HTMLDivElement>(false, '0px');
  return (
    <section id="utility" className="cows-section">
      <div ref={ref} className="cows-stage cows-utility">
        <span className="cows-utility__scan" aria-hidden="true" />
        <div className="cows-utility__head">
          <span className="cows-utility__kicker"><span className="live-dot" />{copy.utilityKicker}</span>
          <h2 className="cows-utility__title">{copy.utilityTitle}</h2>
          <p className="cows-utility__lead">{copy.utilityLead}</p>
        </div>
        <div className="cows-utility__grid">
          {[0, 1, 2, 3].map((i) => (
            <Reveal key={i} delay={i * 110} className="cows-lock">
              <div className="cows-lock__art" aria-hidden="true"><CowArt index={i * 5 + 2} w={240} alt="" /></div>
              <div className="cows-lock__body">
                <span className="cows-lock__icon"><IconLock size={20} /></span>
                <span className="cows-lock__slot mono-num">{copy.utilitySlot} 0{i + 1}</span>
                <Scramble length={10 + ((i * 3) % 5)} active={inView} />
                <span className="cows-lock__soon">{copy.utilityTitle}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Market({ c, copy }: { c: Collection; copy: CowsContent }) {
  const { t } = useI18n();
  return (
    <section id="market" className="cows-section">
      <div className="section__head">
        <h2 className="h1">{copy.nav.market}</h2>
        <Link to={`/collection/${c.slug}`} className="btn btn--outline btn--sm">{t('cows.trade')}</Link>
      </div>
      <Listings c={c} />
      <Traits c={c} />
      <div className="section">
        <h3 className="h2" style={{ marginBottom: 18 }}>{t('cows.activity')}</h3>
        <ActivityTab collection={c.address} />
      </div>
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
    <div className="section" style={{ marginTop: 28 }}>
      <h3 className="h2" style={{ marginBottom: 18 }}>{t('cows.floorListings')}</h3>
      <div className="nft-grid">{tokens.map((tok) => <NftCard key={tok.token_id} token={tok} collection={c} />)}</div>
    </div>
  );
}

function Traits({ c }: { c: Collection }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['traits', c.address], queryFn: () => api.get<{ traits: TraitGroup[]; total: number }>(`/collections/${c.address}/traits`) });
  const groups = q.data?.traits ?? [];
  if (groups.length === 0) return null;
  return (
    <div className="section">
      <h3 className="h2" style={{ marginBottom: 18 }}>{t('cows.traits')}</h3>
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
    </div>
  );
}

/** Three endless rows of artwork, alternating direction. */
function Arts({ copy, onOpen }: { copy: CowsContent; onOpen: (i: number) => void }) {
  const rows = useMemo(() => {
    const all = Array.from({ length: GIWA_COWS.images.length }, (_, i) => i);
    const shift = (k: number) => all.map((i) => cowIndex(i + k));
    return [shift(0), shift(7).reverse(), shift(13)];
  }, []);
  return (
    <section id="arts" className="cows-section cows-arts">
      <div className="container">
        <Reveal className="cows-arts__head">
          <span className="kicker">{GIWA_COWS.name}</span>
          <h2 className="h1">{copy.artsTitle}</h2>
          <p className="lead">{copy.artsLead}</p>
        </Reveal>
      </div>
      <div className="cows-arts__rows">
        <CowMarquee order={rows[0]} reverse seconds={70} onOpen={onOpen} />
        <CowMarquee order={rows[1]} seconds={58} onOpen={onOpen} />
        <CowMarquee order={rows[2]} reverse seconds={80} onOpen={onOpen} />
      </div>
    </section>
  );
}

function Roadmap({ copy }: { copy: CowsContent }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const nowIndex = Math.max(0, copy.roadmap.findIndex((p) => p.status === 'now'));
  return (
    <section id="roadmap" className="cows-section">
      <Reveal className="cows-section__head">
        <span className="kicker">{GIWA_COWS.name}</span>
        <h2 className="h1">{copy.roadmapTitle}</h2>
        <p className="lead">{copy.roadmapLead}</p>
      </Reveal>
      <div ref={ref} className={`roadmap${inView ? ' is-in' : ''}`} style={{ '--now': nowIndex } as CSSProperties}>
        <div className="roadmap__rail" aria-hidden="true"><span className="roadmap__fill" /></div>
        <ol className="roadmap__phases">
          {copy.roadmap.map((p, i) => <Phase key={p.id} p={p} i={i} copy={copy} />)}
        </ol>
      </div>
    </section>
  );
}

function Phase({ p, i, copy }: { p: RoadmapPhase; i: number; copy: CowsContent }) {
  const done = p.items.filter((x) => x.done).length;
  return (
    <Reveal as="li" delay={i * 140} className={`rm-phase rm-phase--${p.status}`}>
      <span className="rm-phase__node" aria-hidden="true"><span /></span>
      <div className="rm-phase__card">
        <span className="rm-phase__numeral mono-num" aria-hidden="true">0{i + 1}</span>
        <div className="rm-phase__top">
          <span className={`rm-phase__status rm-phase__status--${p.status}`}>{p.status === 'now' && <span className="live-dot" />}{copy.status[p.status]}</span>
          {done > 0 && <span className="rm-phase__count mono-num">{done}/{p.items.length}</span>}
        </div>
        <h3 className="rm-phase__name">{p.name}</h3>
        <p className="rm-phase__stage">{p.stage}</p>
        <ul className="rm-phase__items">
          {p.items.map((it) => (
            <li key={it.text} className={it.done ? 'is-done' : ''}>
              <span className="rm-phase__mark" aria-hidden="true">{it.done ? <IconCheck size={13} /> : null}</span>
              <span>{it.text}</span>
              {it.done && <span className="sr-only"> ({copy.status.done})</span>}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

function CowsFaq({ copy, xUrl }: { copy: CowsContent; xUrl: string }) {
  const { t } = useI18n();
  return (
    <section id="faq" className="cows-section cows-faq">
      <Reveal className="cows-faq__side">
        <span className="kicker">{GIWA_COWS.name}</span>
        <h2 className="h1">{copy.faqTitle}</h2>
        <p className="lead">{copy.faqLead}</p>
        <div className="row-wrap">
          {xUrl && <a className="btn" href={xUrl} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={14} />{t('cows.askX')}</a>}
          <Link to="/faq" className="btn btn--outline">{t('cows.moreFaq')}</Link>
        </div>
      </Reveal>
      <Accordion items={copy.faq} idPrefix="cows-faq" openFirst />
    </section>
  );
}

function Join({ copy, xUrl }: { copy: CowsContent; xUrl: string }) {
  const { t } = useI18n();
  return (
    <section className="cows-section">
      <Reveal className="cows-stage cows-join">
        <div className="cows-join__herd" aria-hidden="true">
          {[3, 8, 11, 15, 5].map((k, i) => <span key={k} style={{ '--k': i } as CSSProperties}><CowArt index={k} w={160} alt="" /></span>)}
        </div>
        <h2 className="cows-join__title">{copy.joinTitle}</h2>
        <p className="cows-join__body">{copy.joinBody}</p>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          {xUrl ? (
            <a className="btn btn--lg btn--gold" href={xUrl} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={15} />{t('cows.follow')}</a>
          ) : (
            <Link to="/explore" className="btn btn--lg btn--gold">{t('home.explore')}</Link>
          )}
          <Link to="/launchpad" className="btn btn--lg btn--outline">{t('nav.launchpad')}</Link>
        </div>
      </Reveal>
    </section>
  );
}
