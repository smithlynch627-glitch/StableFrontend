import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { eth, pct, short, shortId, timeAgo, tokenLabel } from '../lib/format';
import type { Collection, Order, Token } from '../lib/types';
import { Avatar, TokenArt } from '../components/Art';
import { IconExternal } from '../components/Icons';
import { useTrade } from '../components/trade';
import { Badge, CopyButton, CountdownLabel, EmptyState, Skeleton } from '../components/ui';
import { ActivityTab } from './Collection';
import { BackButton } from '../components/BackButton';

export default function ItemPage() {
  const { slug = '', id = '' } = useParams();
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const trade = useTrade();
  const { address } = useAccount();
  const q = useQuery({
    queryKey: ['token', slug.toLowerCase(), id],
    queryFn: () => api.get<{ token: Token; collection: Collection; offers: Order[] }>(`/tokens/${slug}/${id}`),
  });

  if (q.isLoading)
    return (
      <div className="page container item-layout">
        <Skeleton h={520} r={22} />
        <div style={{ display: 'grid', gap: 14 }}><Skeleton h={40} w="70%" /><Skeleton h={180} r={14} /><Skeleton h={220} r={14} /></div>
      </div>
    );
  if (!q.data) return <div className="page container"><div className="back-row"><BackButton fallback={`/collection/${slug}`} /></div><EmptyState title={t('item.notFound')} action={<Link className="btn" to={`/collection/${slug}`}>{t('home.viewCollection')}</Link>} /></div>;

  const { token, collection: c, offers } = q.data;
  const me = address?.toLowerCase();
  const mine = !!me && token.owner === me;
  const listed = !!token.listing_hash;
  const listingOrder: Order | null = listed
    ? { hash: token.listing_hash!, kind: 'listing', token_id: token.token_id, maker: token.listing_maker!, price_wei: token.listing_price_wei!, currency: 'ETH', end_time: token.listing_end_time! }
    : null;
  const total = c.total_supply || 1;

  return (
    <div className="page container">
      <div className="back-row"><BackButton fallback={`/collection/${c.slug}`} /></div>
      <div className="item-layout">
        <div className="item-media" style={{ position: 'relative' }}><TokenArt collection={c} token={token} /></div>
        <div className="item-attrs">
          {token.attributes?.length > 0 && (
            <div className="panel">
              <div className="panel__head">{t('item.traits')}</div>
              <div className="panel__body traits-grid">
                {token.attributes.map((a) => (
                  <Link
                    key={a.trait_type}
                    className="trait"
                    to={`/collection/${c.slug}`}
                  >
                    <span className="trait__type">{a.trait_type}</span>
                    <span className="trait__value">{String(a.value)}</span>
                    {a.count !== undefined && <span className="trait__pct">{t('item.traitPct', { pct: pct(a.count, total) })}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel__head">{t('item.details')}</div>
            <dl className="panel__body kv" style={{ margin: 0 }}>
              <div><dt>{t('item.contract')}</dt><dd className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>{short(c.address)}<CopyButton value={c.address} /></dd></div>
              <div><dt>{t('item.tokenId')}</dt><dd className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><span title={token.token_id}>{shortId(token.token_id)}</span>{token.token_id.length > 12 && <CopyButton value={token.token_id} />}</dd></div>
              <div><dt>{t('item.standard')}</dt><dd>ERC-721</dd></div>
              <div><dt>{t('item.chain')}</dt><dd>GIWA Sepolia</dd></div>
              <div><dt>{t('common.royalty')}</dt><dd>{c.royalty_bps / 100}%</dd></div>
              <div><dt>{t('common.explorer')}</dt><dd><a className="link row" style={{ gap: 4 }} href={`${cfg.explorerUrl}/token/${c.address}/instance/${token.token_id}`} target="_blank" rel="noreferrer">GIWA Explorer <IconExternal size={13} /></a></dd></div>
            </dl>
          </div>
        </div>

        <div className="item-side">
          <div style={{ display: 'grid', gap: 10 }}>
            <Link to={`/collection/${c.slug}`} className="row" style={{ gap: 6 }}>
              <span className="strong">{c.name}</span><Badge official={c.is_official} verified={c.verified} />
            </Link>
            <h1 className="h1 item-title" title={token.name || `#${token.token_id}`}>{tokenLabel(token.name, token.token_id)}</h1>
            <div className="row-wrap small">
              <Link to={`/profile/${token.owner}`} className="row" style={{ gap: 8 }}>
                <Avatar address={token.owner} size={26} />
                <span>{mine ? t('item.youOwn') : t('item.ownedBy', { owner: short(token.owner) })}</span>
              </Link>
              {token.rarity_rank && <span className="pill">{t('common.rank', { rank: token.rarity_rank.toLocaleString() })}</span>}
            </div>
          </div>

          <div className="price-box">
            <div>
              <div className="small muted">{t('item.currentPrice')}</div>
              <div className="price-box__value mono-num">{listed ? `${eth(token.listing_price_wei)} ETH` : t('common.notListed')}</div>
              {listed && token.listing_end_time && <div className="small muted" style={{ marginTop: 6 }}><CountdownLabel k="item.endsIn" to={token.listing_end_time} /></div>}
            </div>
            <div className="row-wrap small soft">
              {token.last_sale_wei && <span>{t('common.lastSale', { price: `${eth(token.last_sale_wei)} ETH` })}</span>}
              {offers[0] && <span>{t('common.bestOffer')} {eth(offers[0].price_wei)} WETH</span>}
            </div>
            {c.tradable === false ? <div className="notice">{t('col.notTradable')}</div> : <div className="row" style={{ flexWrap: 'wrap' }}>
              {mine ? (
                <>
                  <button className="btn btn--lg" style={{ flex: 1 }} onClick={() => trade.list(c.address, token)}>{listed ? t('item.editPrice') : t('item.list')}</button>
                  {listingOrder && <button className="btn btn--lg btn--outline" style={{ flex: 1 }} onClick={() => trade.cancel(listingOrder, c.address)}>{t('item.cancelListing')}</button>}
                </>
              ) : (
                <>
                  {listed && <button className="btn btn--lg" style={{ flex: 1 }} onClick={() => trade.buy(c.address, [token])}>{t('col.buyNow')}</button>}
                  <button className={`btn btn--lg ${listed ? 'btn--outline' : ''}`} style={{ flex: 1 }} onClick={() => trade.offer(c.address, token)}>{t('item.makeOffer')}</button>
                </>
              )}
            </div>}
          </div>

          <div className="panel">
            <div className="panel__head">{t('item.offers')} <span className="muted small">{offers.length}</span></div>
            {offers.length === 0 ? (
              <div className="panel__body small muted">{t('item.noOffers')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>{t('common.price')}</th><th>{t('common.from')}</th><th>{t('common.expires')}</th><th /></tr></thead>
                  <tbody>
                    {offers.map((o) => {
                      const byMe = me && o.maker === me;
                      return (
                        <tr key={o.hash}>
                          <td>
                            <div className="strong mono-num">{eth(o.price_wei)} WETH</div>
                            {o.kind === 'collection_offer' && <div className="tiny muted">{t('col.collectionOffer')}</div>}
                          </td>
                          <td><Link className="link" to={`/profile/${o.maker}`}>{byMe ? t('common.you') : short(o.maker)}</Link></td>
                          <td className="muted">{timeAgo(o.end_time, lang)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {byMe ? (
                              <button className="btn btn--outline btn--sm" onClick={() => trade.cancel(o, c.address)}>{t('item.cancelOffer')}</button>
                            ) : mine ? (
                              <button className="btn btn--sm" onClick={() => trade.accept(o, c.address, token)}>{t('item.accept')}</button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="h2" style={{ marginBottom: 18 }}>{t('item.activity')}</h2>
        <ActivityTab collection={c.address} token={token.token_id} />
      </section>
    </div>
  );
}
