import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { eth, tokenLabel } from '../lib/format';
import { useMoney } from '../lib/currency';
import type { Token } from '../lib/types';
import { TokenArt } from './Art';
import { IconCheck } from './Icons';
import { useTrade } from './trade';

type ColLike = { address: string; slug: string; art_style: 'cow' | 'tile' | string; name?: string; tradable?: boolean };

export function NftCard({
  token, collection, sweeping = false, selected = false, onToggle, onQuickSelect, showCollection = false,
}: {
  token: Token; collection: ColLike; sweeping?: boolean; selected?: boolean; onToggle?: () => void; onQuickSelect?: () => void; showCollection?: boolean;
}) {
  const { t } = useI18n();
  const { money } = useMoney();
  const nav = useNavigate();
  const trade = useTrade();
  const { address } = useAccount();
  const mine = !!address && token.owner?.toLowerCase() === address.toLowerCase();
  const listed = !!token.listing_hash;
  const selectable = sweeping && listed && !mine;
  const href = `/item/${collection.slug}/${token.token_id}`;

  function onClick() {
    if (sweeping) {
      if (selectable) onToggle?.();
      return;
    }
    nav(href);
  }

  return (
    <article
      className={`nft-card ${selected ? 'is-selected' : ''} ${sweeping && !selectable ? 'is-disabled' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      tabIndex={0}
      role={sweeping ? 'checkbox' : 'link'}
      aria-checked={sweeping ? selected : undefined}
      aria-label={tokenLabel(token.name, token.token_id)}
    >
      <div className="nft-card__media">
        <TokenArt collection={collection} token={token} />
        {token.rarity_rank && !sweeping && <span className="nft-card__rank">{t('common.rank', { rank: token.rarity_rank.toLocaleString() })}</span>}
        {sweeping && selectable && <span className="nft-card__check">{selected && <IconCheck size={14} />}</span>}
        {!sweeping && onQuickSelect && listed && !mine && collection.tradable !== false && (
          <button type="button" className="nft-card__select" aria-label={t('col.select')} title={t('col.select')} onClick={(e) => { e.stopPropagation(); onQuickSelect(); }}>
            <IconCheck size={14} />
          </button>
        )}
        {!sweeping && collection.tradable !== false && (listed && !mine ? (
          <div className="nft-card__action">
            <button className="btn btn--sm btn--block" onClick={(e) => { e.stopPropagation(); trade.buy(collection.address, [token]); }}>
              {t('col.buyNow')}
            </button>
          </div>
        ) : mine ? (
          <div className="nft-card__action">
            <button className="btn btn--sm btn--block" onClick={(e) => { e.stopPropagation(); trade.list(collection.address, token); }}>
              {listed ? t('item.editPrice') : t('item.list')}
            </button>
          </div>
        ) : null)}
      </div>
      <div className="nft-card__body">
        {showCollection && <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{collection.name}</div>}
        <div className="nft-card__name" title={token.name || `#${token.token_id}`}>{tokenLabel(token.name, token.token_id)}</div>
        <div className="nft-card__price" title={listed ? `${eth(token.listing_price_wei)} ETH` : undefined}>{listed ? money(token.listing_price_wei) : <span className="muted small" style={{ fontWeight: 600 }}>{t('common.notListed')}</span>}</div>
        <div className="nft-card__meta">
          <span>{token.last_sale_wei ? t('common.lastSale', { price: money(token.last_sale_wei) }) : '\u00a0'}</span>
          {mine && <span className="strong" style={{ color: 'var(--fg)' }}>{t('common.you')}</span>}
        </div>
      </div>
    </article>
  );
}
