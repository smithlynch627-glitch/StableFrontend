// About: the collection's story (written by admins), key facts, custom details and links.
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { dateTime, num, short } from '../../lib/format';
import { useAppConfig } from '../../lib/appConfig';
import type { Collection } from '../../lib/types';
import { CollectionBanner, SmartImage, TileArt } from '../Art';
import { IconExternal } from '../Icons';
import { SocialIcon } from '../Social';
import { CopyButton } from '../ui';

const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u);

export function AboutTab({ c }: { c: Collection }) {
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const story = (c.about || c.description || '').trim();
  const facts: [string, React.ReactNode][] = [
    [t('about.contract'), (
      <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
        <a className="link mono-num" href={`${cfg.explorerUrl}/token/${c.address}`} target="_blank" rel="noreferrer">{short(c.address)}</a>
        <CopyButton value={c.address} />
      </span>
    )],
    [t('about.chain'), cfg.network?.name || 'GIWA'],
    [t('about.standard'), 'ERC-721'],
    [t('about.supply'), c.max_supply ? num(c.max_supply, lang) : num(c.total_supply, lang)],
    [t('about.minted'), num(c.total_supply, lang)],
    [t('about.owners'), num(c.owners_count, lang)],
    [t('about.royalty'), `${c.royalty_bps / 100}%`],
    [t('about.creator'), c.creator ? <Link className="link mono-num" to={`/profile/${c.creator}`}>{short(c.creator)}</Link> : '—'],
    [t('about.created'), dateTime(c.created_at, lang)],
  ];
  if (c.revealed !== null && c.revealed !== undefined) facts.push([t('about.metadata'), c.metadata_frozen ? t('about.frozen') : c.revealed ? t('about.revealed') : t('about.unrevealed')]);
  const links = [
    c.twitter && { kind: 'x' as const, href: c.twitter, label: 'X' },
    c.discord && { kind: 'discord' as const, href: c.discord, label: 'Discord' },
    c.telegram && { kind: 'telegram' as const, href: c.telegram, label: 'Telegram' },
    c.website && { kind: 'website' as const, href: c.website, label: t('col.website') },
  ].filter(Boolean) as { kind: 'x' | 'discord' | 'telegram' | 'website'; href: string; label: string }[];

  return (
    <div className="about">
      <div className="about__hero">
        {c.about_image_url ? (
          <SmartImage src={toHttp(c.about_image_url)} alt={c.name} fallback={<TileArt seed={c.address} wide />} />
        ) : (
          <CollectionBanner collection={c} />
        )}
      </div>
      <div className="about__layout">
        <article className="about__story">
          <h2 className="h2">{t('about.title', { name: c.name })}</h2>
          {story ? story.split(/\n{2,}/).map((para, i) => <p key={i} className="soft">{para}</p>) : <p className="muted">{t('about.empty')}</p>}
          {!!c.about_items?.length && (
            <dl className="about__items">
              {c.about_items.map((it) => (
                <div key={it.label}><dt>{it.label}</dt><dd>{it.value}</dd></div>
              ))}
            </dl>
          )}
          {links.length > 0 && (
            <div className="about__links">
              {links.map((l) => (
                <a key={l.kind} className="btn btn--outline btn--sm" href={l.href} target="_blank" rel="noreferrer noopener">
                  <SocialLinkIcon kind={l.kind} />{l.label}<IconExternal size={13} />
                </a>
              ))}
            </div>
          )}
        </article>
        <aside className="about__facts">
          <h3 className="h3">{t('about.details')}</h3>
          <dl className="kv">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function SocialLinkIcon({ kind }: { kind: 'x' | 'discord' | 'telegram' | 'website' }) {
  return <span className="about__icon"><SocialIcon kind={kind} size={14} /></span>;
}
