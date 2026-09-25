import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { dateTime, eth, pct, short, shortId, timeAgo, tokenLabel } from '../lib/format';
import { usdText, useMoney } from '../lib/currency';
import type { Activity, Collection, Order, Token } from '../lib/types';
import { Avatar, CollectionAvatar, TokenArt } from '../components/Art';
import { IconChevron, IconCopy, IconExternal, IconShare } from '../components/Icons';
import { SocialIcon } from '../components/Social';
import { useTrade } from '../components/trade';
import { NftCard } from '../components/NftCard';
import { ChartCard, ScatterChart } from '../components/Charts';
import { Badge, CopyButton, CountdownLabel, EmptyState, Skeleton, useToast } from '../components/ui';
import { ActivityTab } from './Collection';
import { BackButton } from '../components/BackButton';

const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u);

export default function ItemPage() {
  const { slug = '', id = '' } = useParams();
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const trade = useTrade();
  const toast = useToast();
  const { money, usd, isUsd, rate } = useMoney();
  const { address } = useAccount();
  const [zoom, setZoom] = useState(false);
  const q = useQuery({
    queryKey: ['token', slug.toLowerCase(), id],
    queryFn: () => api.get<{ token: Token; collection: Collection; offers: Order[] }>(`/tokens/${slug}/${id}`),
  });
  const colAddr = q.data?.collection.address;
  const sales = useQuery({
    queryKey: ['token-sales', colAddr, id],
    queryFn: () => api.get<{ activity: Activity[] }>('/activity', { collection: colAddr, token: id, types: 'sale', limit: 100 }),
    enabled: !!colAddr,
  });
  const more = useQuery({
    queryKey: ['more-from', colAddr],
    queryFn: () => api.get<{ tokens: Token[] }>(`/collections/${colAddr}/tokens`, { sort: 'price_asc', limit: 9 }),
    enabled: !!colAddr,
  });
  const points = useMemo(
    () => (sales.data?.activity ?? []).filter((a) => a.price_wei).map((a) => {
      const v = Number(formatEther(BigInt(a.price_wei!)));
      return { t: +new Date(a.created_at), v: isUsd && rate ? v * rate : v, label: a.to_addr || '' };
    }).reverse(),
    [sales.data, isUsd, rate],
  );

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
  const link = `${window.location.origin}/item/${c.slug}/${token.token_id}`;
  const title = tokenLabel(token.name, token.token_id);
  const fmtV = (v: number) => (isUsd && rate ? usdText(v) : `${Number(v.toPrecision(3))} ETH`);
  const others = (more.data?.tokens ?? []).filter((x) => x.token_id !== token.token_id).slice(0, 8);
  // Time window for the price chart: from a little before the first sale to now (at least 6 hours wide).
  const t1 = Date.now();
  const span = Math.max(points.length ? t1 - points[0].t : 7 * 86400e3, 6 * 3600e3);
  const t0 = (points.length ? points[0].t : t1 - span) - span * 0.08;

  async function share() {
    if (navigator.share) await navigator.share({ title, url: link }).catch(() => undefined);
    else navigator.clipboard?.writeText(link).then(() => toast(t('col.linkCopied')));
  }

  return (
    <div className="page container item-page">
      <div className="item-topbar">
        <nav className="crumbs" aria-label="Breadcrumb">
          <BackButton fallback={`/collection/${c.slug}`} />
          <Link to={`/collection/${c.slug}`} className="crumbs__link hide-sm">{c.name}</Link>
          <IconChevron size={14} className="crumbs__sep hide-sm" />
          <span className="crumbs__here hide-sm">#{shortId(token.token_id)}</span>
        </nav>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" onClick={share} aria-label={t('col.share')} title={t('col.share')}><IconShare size={16} /></button>
          <button className="icon-btn" onClick={() => navigator.clipboard?.writeText(link).then(() => toast(t('col.linkCopied')))} aria-label={t('col.copyLink')} title={t('col.copyLink')}><IconCopy size={16} /></button>
          <a className="icon-btn" href={`https://x.com/intent/tweet?text=${encodeURIComponent(`${title} · ${c.name}`)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" aria-label={t('col.shareX')} title={t('col.shareX')}><SocialIcon kind="x" size={14} /></a>
          <a className="icon-btn" href={`${cfg.explorerUrl}/token/${c.address}/instance/${token.token_id}`} target="_blank" rel="noreferrer" aria-label={t('col.viewOnChain')} title={t('col.viewOnChain')}><IconExternal size={16} /></a>
        </div>
      </div>

      <div className="item-layout">
        <button type="button" className="item-media" onClick={() => token.image_url && setZoom(true)} aria-label={title}>
          <TokenArt collection={c} token={token} />
          {token.rarity_rank && <span className="item-media__rank">{t('common.rank', { rank: token.rarity_rank.toLocaleString() })}</span>}
        </button>

        <div className="item-side">
          <div className="item-head">
            <Link to={`/collection/${c.slug}`} className="item-head__col">
              <span className="item-head__avatar"><CollectionAvatar collection={c} /></span>
              <span className="strong">{c.name}</span><Badge official={c.is_official} verified={c.verified} />
            </Link>
            <h1 className="h1 item-title" title={token.name || `#${token.token_id}`}>{title}</h1>
            <div className="row-wrap small">
              <Link to={`/profile/${token.owner}`} className="item-owner">
                <Avatar address={token.owner} size={28} />
                <span style={{ display: 'grid' }}>
                  <span className="tiny muted">{t('common.owner')}</span>
                  <span className="strong">{mine ? t('common.you') : short(token.owner)}</span>
                </span>
              </Link>
            </div>
          </div>

          <div className="price-box">
            <div className="price-box__top">
              <div>
                <div className="small muted">{t('item.currentPrice')}</div>
                <div className="price-box__value mono-num">{listed ? `${eth(token.listing_price_wei)} ETH` : t('common.notListed')}</div>
                {listed && usd(token.listing_price_wei) && <div className="small soft mono-num">≈ {usd(token.listing_price_wei)}</div>}
              </div>
              {listed && token.listing_end_time && <span className="pill pill--outline"><CountdownLabel k="item.endsIn" to={token.listing_end_time} /></span>}
            </div>
            <div className="price-box__facts">
              <span><span className="muted">{t('col.lastSale')}</span><strong className="mono-num">{token.last_sale_wei ? money(token.last_sale_wei) : '—'}</strong></span>
              <span><span className="muted">{t('common.bestOffer')}</span><strong className="mono-num">{offers[0] ? money(offers[0].price_wei, 'WETH') : '—'}</strong></span>
              <span><span className="muted">{t('common.floor')}</span><strong className="mono-num">{c.floor_wei ? `${eth(c.floor_wei)} ETH` : '—'}</strong></span>
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

          <ChartCard
            title={t('an.priceHistory')}
            sub={isUsd ? 'USD' : 'ETH'}
            empty={!points.length}
            emptyText={t('item.noSales')}
            tableLabel={t('an.table')}
            chartLabel={t('an.chart')}
            table={{ head: [t('an.time'), t('common.price'), t('common.to')], rows: [...points].reverse().map((p) => [dateTime(new Date(p.t), lang), fmtV(p.v), short(p.label)]) }}
          >
            <ScatterChart data={points} height={180} t0={t0} t1={t1} fmt={fmtV}
              fmtT={(ts) => new Date(ts).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', t1 - t0 < 2 * 86400e3 ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' })}
              tip={(p) => (<><strong>{fmtV(p.v)}</strong><span className="muted">{dateTime(new Date(p.t), lang)}</span></>)} />
          </ChartCard>

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
                            <div className="strong mono-num">{money(o.price_wei, 'WETH')}</div>
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

        <div className="item-attrs">
          {token.attributes?.length > 0 && (
            <div className="panel">
              <div className="panel__head">{t('item.traits')} <span className="muted small">{token.attributes.length}</span></div>
              <div className="panel__body traits-grid">
                {token.attributes.map((a) => {
                  const share = a.count !== undefined ? pct(a.count, total) : null;
                  return (
                    <Link key={a.trait_type} className="trait" to={`/collection/${c.slug}`}>
                      <span className="trait__type">{a.trait_type}</span>
                      <span className="trait__value">{String(a.value)}</span>
                      {share !== null && (
                        <>
                          <span className="trait__bar"><span style={{ width: `${Math.min(100, Math.max(3, share))}%` }} /></span>
                          <span className="trait__pct">{t('item.traitPct', { pct: share })}</span>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel__head">{t('item.details')}</div>
            <dl className="panel__body kv" style={{ margin: 0 }}>
              <div><dt>{t('item.contract')}</dt><dd className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><a className="link" href={`${cfg.explorerUrl}/token/${c.address}`} target="_blank" rel="noreferrer">{short(c.address)}</a><CopyButton value={c.address} /></dd></div>
              <div><dt>{t('item.tokenId')}</dt><dd className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><span title={token.token_id}>{shortId(token.token_id)}</span>{token.token_id.length > 12 && <CopyButton value={token.token_id} />}</dd></div>
              <div><dt>{t('item.standard')}</dt><dd>ERC-721</dd></div>
              <div><dt>{t('item.chain')}</dt><dd>{cfg.network?.name || 'GIWA'}</dd></div>
              <div><dt>{t('common.royalty')}</dt><dd>{c.royalty_bps / 100}%</dd></div>
              {token.rarity_rank && <div><dt>{t('col.rarity')}</dt><dd>{t('item.rankOf', { rank: token.rarity_rank.toLocaleString(), total: total.toLocaleString() })}</dd></div>}
              <div><dt>{t('common.explorer')}</dt><dd><a className="link row" style={{ gap: 4 }} href={`${cfg.explorerUrl}/token/${c.address}/instance/${token.token_id}`} target="_blank" rel="noreferrer">GIWA Explorer <IconExternal size={13} /></a></dd></div>
            </dl>
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="h2" style={{ marginBottom: 18 }}>{t('item.activity')}</h2>
        <ActivityTab collection={c.address} token={token.token_id} />
      </section>

      {others.length > 0 && (
        <section className="section">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 className="h2">{t('item.moreFrom', { name: c.name })}</h2>
            <Link className="btn btn--outline btn--sm" to={`/collection/${c.slug}`}>{t('home.viewCollection')}</Link>
          </div>
          <div className="nft-row">
            {others.map((x) => <NftCard key={x.token_id} token={x} collection={c} />)}
          </div>
        </section>
      )}

      {zoom && token.image_url && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setZoom(false)}>
          <img src={toHttp(token.image_url)} alt={title} />
        </div>
      )}
    </div>
  );
}
