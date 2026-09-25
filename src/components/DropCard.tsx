import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { eth, num } from '../lib/format';
import type { DropListItem } from '../lib/types';
import { CollectionAvatar, CollectionBanner } from './Art';
import { Badge, CountdownLabel, Progress } from './ui';

export function DropStatusPill({ d }: { d: Pick<DropListItem, 'status' | 'livePhase' | 'nextPhase'> }) {
  const { t } = useI18n();
  if (d.status === 'live') return <span className="pill pill--live">{t('lp.live')}</span>;
  if (d.status === 'upcoming') return <span className="pill">{t('lp.upcoming')}</span>;
  if (d.status === 'sold_out') return <span className="pill">{t('lp.soldOut')}</span>;
  return <span className="pill">{t('lp.ended')}</span>;
}

export function phasePrice(wei: string | undefined, free: string) {
  if (!wei) return '—';
  return BigInt(wei) === 0n ? free : `${eth(wei)} ETH`;
}

export function DropCard({ d }: { d: DropListItem }) {
  const { t, lang } = useI18n();
  const c = d.collection;
  const phase = d.livePhase ?? d.nextPhase ?? d.phases[d.phases.length - 1];
  return (
    <Link to={`/launchpad/${c.slug}`} className="drop-card">
      <div className="drop-card__media">
        <DropStatusPill d={d} />
        {c.banner_url || c.art_style === 'tile' ? <CollectionBanner collection={c} /> : <CollectionAvatar collection={c} />}
      </div>
      <div className="drop-card__body">
        <div className="row" style={{ gap: 10 }}>
          <span className="thumb thumb--sm" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}><span className="h3" style={{ fontSize: 16 }}>{c.name}</span><Badge official={c.is_official} verified={c.verified} size={15} /></div>
            <div className="tiny muted">{phase?.name}</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="strong">{phasePrice(phase?.priceWei, t('lp.free'))}</span>
          <span className="small muted">
            {d.status === 'live' && d.livePhase?.end && <CountdownLabel k="lp.endsIn" to={d.livePhase.end} />}
            {d.status === 'upcoming' && d.nextPhase && <CountdownLabel k="lp.startsIn" to={d.nextPhase.start} />}
          </span>
        </div>
        <div>
          <Progress value={c.total_supply} max={c.max_supply || 1} />
          <div className="progress-meta"><span>{t('lp.minted', { n: num(c.total_supply, lang), max: num(c.max_supply, lang) })}</span><span className="muted">{c.max_supply ? Math.floor((c.total_supply / c.max_supply) * 100) : 0}%</span></div>
        </div>
      </div>
    </Link>
  );
}
