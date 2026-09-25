import { Link } from 'react-router-dom';
import { useAppConfig } from '../lib/appConfig';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { eth, short, timeAgo, tokenLabel } from '../lib/format';
import type { Activity } from '../lib/types';
import { TokenArt, CollectionAvatar } from './Art';
import { IconBag, IconExternal, IconHand, IconSpark, IconSwap, IconTag, IconClose } from './Icons';

const ICONS: Record<string, JSX.Element> = {
  sale: <IconBag size={15} />, list: <IconTag size={15} />, delist: <IconClose size={15} />, mint: <IconSpark size={15} />,
  transfer: <IconSwap size={15} />, offer: <IconHand size={15} />, collection_offer: <IconHand size={15} />, offer_cancel: <IconClose size={15} />,
};

function Who({ a }: { a: string | null }) {
  const { t } = useI18n();
  if (!a) return <span className="muted">—</span>;
  if (/^0x0{40}$/.test(a)) return <span className="muted">{t('act.type.mint')}</span>;
  return <Link className="link" to={`/profile/${a}`} onClick={(e) => e.stopPropagation()}>{short(a)}</Link>;
}

function ItemCell({ a }: { a: Activity }) {
  const col = { address: a.collection, art_style: a.art_style, image_url: a.collection_image, name: a.collection_name };
  const inner = (
    <span className="cell-item">
      <span className="thumb thumb--sm" style={{ position: 'relative' }}>
        {a.token_id ? <TokenArt collection={col} token={{ token_id: a.token_id, image_url: a.token_image, attributes: a.token_attributes }} /> : <CollectionAvatar collection={col} />}
      </span>
      <span style={{ display: 'grid', minWidth: 0 }}>
        <span className="strong" style={{ fontSize: 14 }}>{a.token_id ? tokenLabel(a.token_name, a.token_id) : a.collection_name}</span>
        <span className="tiny muted">{a.collection_name}</span>
      </span>
    </span>
  );
  return a.token_id ? <Link to={`/item/${a.collection_slug}/${a.token_id}`}>{inner}</Link> : <Link to={`/collection/${a.collection_slug}`}>{inner}</Link>;
}

export function ActivityList({ items }: { items: Activity[] }) {
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const typeLabel = (type: string) => t(`act.type.${type}` as DictKey);
  const time = (a: Activity) =>
    a.tx_hash ? (
      <a className="link row" style={{ gap: 4, justifyContent: 'flex-end' }} href={`${cfg.explorerUrl}/tx/${a.tx_hash}`} target="_blank" rel="noreferrer">
        {timeAgo(a.created_at, lang)} <IconExternal size={13} />
      </a>
    ) : (
      <span className="muted">{timeAgo(a.created_at, lang)}</span>
    );

  return (
    <>
      <div className="table-wrap act-table">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.event')}</th>
              <th>{t('common.item')}</th>
              <th className="num">{t('common.price')}</th>
              <th>{t('common.from')}</th>
              <th>{t('common.to')}</th>
              <th className="num">{t('common.time')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td><span className={`act-type act-type--${a.type}`}><span className="act-type__icon">{ICONS[a.type]}</span>{typeLabel(a.type)}</span></td>
                <td><ItemCell a={a} /></td>
                <td className="num strong">{a.price_wei ? `${eth(a.price_wei)} ${a.type.includes('offer') ? 'WETH' : 'ETH'}` : '—'}</td>
                <td><Who a={a.from_addr} /></td>
                <td><Who a={a.to_addr} /></td>
                <td className="num">{time(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="act-list-mobile">
        {items.map((a) => (
          <div key={a.id} className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className={`act-type act-type--${a.type}`}><span className="act-type__icon">{ICONS[a.type]}</span>{typeLabel(a.type)}</span>
              <span className="small">{time(a)}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <ItemCell a={a} />
              <span className="strong nowrap">{a.price_wei ? `${eth(a.price_wei)} ${a.type.includes('offer') ? 'WETH' : 'ETH'}` : ''}</span>
            </div>
            <div className="small row" style={{ gap: 6 }}>
              <span className="muted">{t('common.from')}</span> <Who a={a.from_addr} />
              {a.to_addr && <><span className="muted">{t('common.to')}</span> <Who a={a.to_addr} /></>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
