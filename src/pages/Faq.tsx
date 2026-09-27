import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Accordion, useFaqGroups } from '../components/Faq';
import { IconClose, IconSearch } from '../components/Icons';
import type { FaqGroup } from '../content/faq';

/** Full Marketplace, Launchpad and Wallet safety FAQ with search. */
export default function FaqPage() {
  const { t } = useI18n();
  const groups = useFaqGroups();
  const { hash } = useLocation();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<FaqGroup['id']>('marketplace');
  const term = q.trim().toLowerCase();

  const shown = useMemo(() => {
    if (!term) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((it) => `${it.q} ${it.a.join(' ')}`.toLowerCase().includes(term)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, term]);
  const total = shown.reduce((n, g) => n + g.items.length, 0);

  useEffect(() => {
    const id = hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [hash]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id as FaqGroup['id']);
    }, { rootMargin: '-30% 0px -60% 0px' });
    shown.forEach((g) => { const el = document.getElementById(g.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [shown]);

  return (
    <div className="page container faq-page">
      <header className="faq-hero">
        <span className="kicker">{t('faq.kicker')}</span>
        <h1 className="display">{t('faq.pageTitle')}</h1>
        <p className="lead">{t('faq.pageSub')}</p>
        <label className="faq-search">
          <IconSearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('faq.search')} aria-label={t('faq.search')} />
          {q && <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label={t('common.close')}><IconClose size={16} /></button>}
        </label>
        {term && <p className="small muted" aria-live="polite">{t('faq.results', { n: total })}</p>}
      </header>

      <div className="faq-layout">
        <nav className="faq-toc" aria-label={t('faq.title')}>
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className={active === g.id ? 'is-active' : ''}
              onClick={(e) => { e.preventDefault(); document.getElementById(g.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#${g.id}`); setActive(g.id); }}>
              <span className="strong">{g.title}</span>
              <span className="tiny muted">{t('faq.count', { n: g.items.length })}</span>
            </a>
          ))}
        </nav>
        <div className="faq-groups">
          {shown.length === 0 && (
            <div className="faq-empty">
              <strong>{t('faq.empty')}</strong>
              <Link to="/support" className="btn btn--outline btn--sm">{t('nav.support')}</Link>
            </div>
          )}
          {shown.map((g) => (
            <section key={g.id} id={g.id} className="faq-group" aria-labelledby={`${g.id}-title`}>
              <div className="faq-group__head">
                <h2 id={`${g.id}-title`} className="h1">{g.title}</h2>
                <p className="soft">{g.intro}</p>
              </div>
              <Accordion key={`${g.id}:${term}`} items={g.items} idPrefix={`faq-${g.id}`} openFirst={!!term} />
            </section>
          ))}
          <div className="faq-help">
            <div>
              <h2 className="h2">{t('faq.helpTitle')}</h2>
              <p className="soft">{t('faq.helpBody')}</p>
            </div>
            <Link to="/support" className="btn btn--lg">{t('nav.support')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
