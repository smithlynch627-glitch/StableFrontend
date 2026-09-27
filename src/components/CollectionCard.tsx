import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { eth, num } from '../lib/format';
import type { Collection } from '../lib/types';
import { CollectionAvatar, CollectionBanner } from './Art';
import { Badge } from './ui';

/** Banner card for a collection: name, tick, floor, 24h volume and items. */
export function CollectionCard({ c, featured = false }: { c: Collection; featured?: boolean }) {
  const { t, lang } = useI18n();
  return (
    <Link to={`/collection/${c.slug}`} className={`col-card${featured ? ' col-card--featured' : ''}`}>
      <div className="col-card__banner" style={{ position: 'relative' }}><CollectionBanner collection={c} /></div>
      <div className="col-card__body">
        <div className="col-card__avatar" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></div>
        <div className="row" style={{ gap: 6 }}><span className="h3">{c.name}</span><Badge official={c.is_official} verified={c.verified} /></div>
        <div className="col-card__stats">
          <div><div className="muted tiny">{t('common.floor')}</div><div className="strong">{c.floor_wei ? `${eth(c.floor_wei)}` : '—'}</div></div>
          <div><div className="muted tiny">{t('common.volume24h')}</div><div className="strong">{eth(c.volume_24h_wei)}</div></div>
          <div><div className="muted tiny">{t('common.items')}</div><div className="strong">{num(c.total_supply, lang)}</div></div>
        </div>
      </div>
    </Link>
  );
}
