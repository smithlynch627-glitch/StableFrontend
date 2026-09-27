import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAppConfig } from '../lib/appConfig';
import { faqGroups, type FaqGroup, type FaqItem } from '../content/faq';
import { IconArrowRight, IconPlus } from './Icons';

/** Question list where one answer opens at a time, with a smooth height animation. */
export function Accordion({ items, idPrefix, openFirst = false, numbered = true }: { items: FaqItem[]; idPrefix: string; openFirst?: boolean; numbered?: boolean }) {
  const [open, setOpen] = useState<number | null>(openFirst ? 0 : null);
  return (
    <div className="faq-list">
      {items.map((it, i) => {
        const isOpen = open === i;
        const id = `${idPrefix}-${i}`;
        return (
          <div key={`${idPrefix}-${it.q}`} className={`faq-item${isOpen ? ' is-open' : ''}`}>
            <h3 className="faq-item__q">
              <button type="button" id={`${id}-q`} aria-expanded={isOpen} aria-controls={`${id}-a`} onClick={() => setOpen(isOpen ? null : i)}>
                {numbered && <span className="faq-item__num mono-num">{String(i + 1).padStart(2, '0')}</span>}
                <span className="faq-item__text">{it.q}</span>
                <span className="faq-item__icon" aria-hidden="true"><IconPlus size={18} /></span>
              </button>
            </h3>
            <div className="faq-item__a" id={`${id}-a`} role="region" aria-labelledby={`${id}-q`}>
              <div className="faq-item__inner">
                <div className={`faq-item__body${numbered ? '' : ' faq-item__body--flush'}`}>
                  {it.a.map((p, k) => <p key={k}>{p}</p>)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The marketplace, launchpad and wallet-safety questions with the live fees filled in. */
export function useFaqGroups(): FaqGroup[] {
  const { lang } = useI18n();
  const cfg = useAppConfig();
  return useMemo(() => faqGroups(lang, { market: cfg.marketFeeBps, mint: cfg.mintFeeBps }), [lang, cfg.marketFeeBps, cfg.mintFeeBps]);
}

/** Compact FAQ for the bottom of a page: tabs for each group and a link to the full FAQ. */
export function FaqSection({ only, limit = 6 }: { only?: FaqGroup['id'][]; limit?: number }) {
  const { t } = useI18n();
  const groups = useFaqGroups().filter((g) => !only || only.includes(g.id));
  const [tab, setTab] = useState(groups[0]?.id);
  const g = groups.find((x) => x.id === tab) ?? groups[0];
  if (!g) return null;
  return (
    <section className="section faq-block" aria-labelledby="faq-block-title">
      <div className="faq-block__side">
        <span className="kicker">{t('faq.kicker')}</span>
        <h2 id="faq-block-title" className="h1">{t('faq.title')}</h2>
        <p className="soft">{t('faq.sub')}</p>
        {groups.length > 1 && (
          <div className="faq-tabs" role="tablist" aria-label={t('faq.title')}>
            {groups.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className="faq-tab" onClick={() => setTab(x.id)}>
                <span className="strong">{x.title}</span>
                <span className="tiny muted">{x.intro}</span>
              </button>
            ))}
          </div>
        )}
        <Link to={`/faq#${g.id}`} className="btn btn--outline">{t('faq.all')}<IconArrowRight size={16} /></Link>
      </div>
      <div role="tabpanel" aria-label={g.title}>
        <Accordion key={g.id} items={g.items.slice(0, limit)} idPrefix={`faq-${g.id}`} openFirst />
      </div>
    </section>
  );
}
