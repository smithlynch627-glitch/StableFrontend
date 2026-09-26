import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { eth, tokenLabel } from '../lib/format';
import { useMoney } from '../lib/currency';
import type { Token } from '../lib/types';
import { TokenArt } from './Art';
import { IconCheck } from './Icons';
import { RarityRank } from './Rarity';
import { useTrade } from './trade';

type ColLike = { address: string; slug: string; art_style: 'cow' | 'tile' | string; name?: string; tradable?: boolean; total_supply?: number };

export function NftCard({
  token, collection, sweeping = false, manage = false, selected = false, onToggle, onQuickSelect, showCollection = false,
}: {
  token: Token; collection: ColLike; sweeping?: boolean; manage?: boolean; selected?: boolean; onToggle?: () => void; onQuickSelect?: () => void; showCollection?: boolean;
}) {
  const { t } = useI18n();
  const { money } = useMoney();
  const nav = useNavigate();
  const trade = useTrade();
  const { address } = useAccount();
  const mine = !!address && token.owner?.toLowerCase() === address.toLowerCase();
  const listed = !!token.listing_hash;
  // sweeping: pick listings to buy · manage: pick your own items to list, delist or send
  const selecting = sweeping || manage;
  // Manage mode only picks your own items; sweep mode only picks other people's listings.
  const selectable = (manage && mine) || (sweeping && listed && !mine);
  const href = `/item/${collection.slug}/${token.token_id}`;

  function onClick() {
    if (selecting) {
      if (selectable) onToggle?.();
      return;
    }
    nav(href);
  }

  return (
    <article
      className={`nft-card ${selected ? 'is-selected' : ''} ${selecting && !selectable ? 'is-disabled' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      tabIndex={0}
      role={selecting ? 'checkbox' : 'link'}
      aria-checked={selecting ? selected : undefined}
      aria-label={tokenLabel(token.name, token.token_id)}
    >
      <div className="nft-card__media">
        <TokenArt collection={collection} token={token} />
        {selecting && selectable && <span className="nft-card__check">{selected && <IconCheck size={14} />}</span>}
        {!selecting && onQuickSelect && listed && !mine && collection.tradable !== false && (
          <button type="button" className="nft-card__select" aria-label={t('col.select')} title={t('col.select')} onClick={(e) => { e.stopPropagation(); onQuickSelect(); }}>
            <IconCheck size={14} />
          </button>
        )}
        {!selecting && collection.tradable !== false && (listed && !mine ? (
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
        {showCollection && <div className="nft-card__col">{collection.name}</div>}
        <div className="nft-card__head">
          <div className="nft-card__name" title={token.name || `#${token.token_id}`}>{tokenLabel(token.name, token.token_id)}</div>
          {token.rarity_rank && collection.total_supply ? <RarityRank rank={token.rarity_rank} of={collection.total_supply} variant="tag" /> : null}
        </div>
        <div className="nft-card__price" title={listed ? `${eth(token.listing_price_wei)} ETH` : undefined}>
          {listed ? money(token.listing_price_wei) : <span className="nft-card__unlisted">{t('common.notListed')}</span>}
        </div>
        <div className="nft-card__meta">
          <span className="nft-card__last" title={token.last_sale_wei ? `${eth(token.last_sale_wei)} ETH` : undefined}>
            {t('card.lastSale')} <b>{token.last_sale_wei ? money(token.last_sale_wei) : '—'}</b>
          </span>
          {mine && <span className="nft-card__you">{t('common.you')}</span>}
        </div>
      </div>
    </article>
  );
}
