// Terms of Use and Privacy Policy (English and Korean). The text set in the admin panel is shown when there is
// one; otherwise the built-in text from content/legal.ts.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { BRAND } from '../config';
import { api } from '../lib/api';
import { Blocks, parseLegal, type Block, type LegalSection } from '../lib/legalText';
import { UPDATED, legalDocs } from '../content/legal';
import { BackButton } from '../components/BackButton';
import { Skeleton } from '../components/ui';

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t, lang } = useI18n();
  const l = lang === 'ko' ? 'ko' : 'en';
  const q = useQuery({
    queryKey: ['legal', kind, l],
    queryFn: () => api.get<{ doc: { text: string; updated: string | null } | null }>(`/legal/${kind}`, { lang: l }),
    staleTime: 30_000,
    retry: 0,
  });
  const builtIn = legalDocs(BRAND.name)[kind][l];
  const view = useMemo(() => {
    const custom = q.data?.doc;
    if (custom?.text) {
      const d = parseLegal(custom.text);
      return { intro: d.intro, sections: d.sections, updated: custom.updated || UPDATED };
    }
    const sections: LegalSection[] = builtIn.sections.map((x) => ({ h: x.h, blocks: x.p.map((p): Block => ({ t: 'p', text: p })) }));
    return { intro: [{ t: 'p', text: builtIn.intro } as Block], sections, updated: UPDATED };
  }, [q.data, builtIn]);
  const title = builtIn.title;

  if (q.isLoading) return <div className="page container legal"><Skeleton h={420} r={18} /></div>;
  return (
    <div className="page container legal">
      <div className="back-row"><BackButton /></div>
      <header className="legal__head">
        <span className="pill pill--outline">{t('legal.updated', { date: view.updated })}</span>
        <h1 className="h1">{title}</h1>
        <div className="legal__intro"><Blocks blocks={view.intro} className="lead" /></div>
      </header>
      <div className="legal__layout">
        <nav className="legal__toc" aria-label={title}>
          {view.sections.map((s, i) => <a key={`${i}:${s.h}`} href={`#s${i + 1}`}>{s.h}</a>)}
        </nav>
        <article className="legal__body">
          {view.sections.map((s, i) => (
            <section key={`${i}:${s.h}`} id={`s${i + 1}`}>
              <h2 className="h3">{s.h}</h2>
              <Blocks blocks={s.blocks} />
            </section>
          ))}
          <div className="row-wrap" style={{ marginTop: 18 }}>
            <Link className="btn btn--outline btn--sm" to={kind === 'terms' ? '/privacy' : '/terms'}>{kind === 'terms' ? t('legal.privacy') : t('legal.terms')}</Link>
            <Link className="btn btn--sm" to="/support">{t('nav.support')}</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
