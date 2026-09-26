import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { dateTime, eth, explorerCollectionUrl, short, shortId, timeAgo, tokenLabel } from '../lib/format';
import { usdText, useMoney } from '../lib/currency';
import type { Activity, Collection, Order, Token } from '../lib/types';
import { Avatar, CollectionAvatar, TokenArt, fixImageUrl, isVideoUrl } from '../components/Art';
import { IconChevron, IconCopy, IconExternal, IconShare, IconTag } from '../components/Icons';
import { SocialIcon } from '../components/Social';
import { useTrade } from '../components/trade';
import { NftCard } from '../components/NftCard';
import { ChartCard, ScatterChart } from '../components/Charts';
import { RarityPanel, RarityRank, TraitShare } from '../components/Rarity';
import { Badge, CopyButton, CountdownLabel, EmptyState, Skeleton, Tabs, useToast } from '../components/ui';
import { ActivityTab } from './Collection';
import { BackButton } from '../components/BackButton';

const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u);
type InfoTab = 'offers' | 'history' | 'details';

export default function ItemPage() {
  const { slug = '', id = '' } = useParams();
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const trade = useTrade();
  const toast = useToast();
  const { money, usd, isUsd, rate } = useMoney();
  const { address } = useAccount();
  const [zoom, setZoom] = useState(false);
  const [tab, setTab] = useState<InfoTab>('offers');
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
      <div className="page container item-v3">
        <div className="item-v3__grid">
          <Skeleton h={560} r={24} />
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}><Skeleton h={28} w="40%" /><Skeleton h={44} w="70%" /><Skeleton h={190} r={18} /><Skeleton h={160} r={18} /><Skeleton h={220} r={18} /></div>
        </div>
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
  const rankOf = token.rarity_of || total;
  const link = `${window.location.origin}/item/${c.slug}/${token.token_id}`;
  const title = tokenLabel(token.name, token.token_id);
  const fmtV = (v: number) => (isUsd && rate ? usdText(v) : `${Number(v.toPrecision(3))} ETH`);
  const others = (more.data?.tokens ?? []).filter((x) => x.token_id !== token.token_id).slice(0, 8);
  const traits = token.attributes ?? [];
  // Time window for the price chart: from a little before the first sale to now (at least 6 hours wide).
  const t1 = Date.now();
  const span = Math.max(points.length ? t1 - points[0].t : 7 * 86400e3, 6 * 3600e3);
  const t0 = (points.length ? points[0].t : t1 - span) - span * 0.08;
  const traitLink = (type: string, value: string) => `/collection/${c.slug}?traits=${encodeURIComponent(JSON.stringify({ [type]: [value] }))}`;

  async function share() {
    if (navigator.share) await navigator.share({ title, url: link }).catch(() => undefined);
    else navigator.clipboard?.writeText(link).then(() => toast(t('col.linkCopied')));
  }

  return (
    <div className="page container item-v3">
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

      <div className="item-v3__grid">
        {/* Left: only the artwork (sticky on wide screens), so nothing can ever scroll underneath it. */}
        <div className="item-v3__media-col">
          <div className="item-v3__media">
            <button type="button" className="item-v3__art" onClick={() => token.image_url && setZoom(true)} aria-label={title}>
              <TokenArt collection={c} token={token} />
            </button>
            {token.rarity_rank && <RarityRank rank={token.rarity_rank} of={rankOf} variant="media" className="item-v3__rank" />}
          </div>
        </div>

        <div className="item-v3__info">
          <header className="item-v3__head">
            <Link to={`/collection/${c.slug}`} className="item-head__col">
              <span className="item-head__avatar"><CollectionAvatar collection={c} /></span>
              <span className="strong">{c.name}</span><Badge official={c.is_official} verified={c.verified} />
            </Link>
            <h1 className="item-v3__title" title={token.name || `#${token.token_id}`}>{title}</h1>
            <div className="item-v3__meta">
              <Link to={`/profile/${token.owner}`} className="item-v3__owner">
                <Avatar address={token.owner} size={30} />
                <span style={{ display: 'grid', lineHeight: 1.25 }}>
                  <span className="tiny muted">{t('common.owner')}</span>
                  <span className="strong">{mine ? t('common.you') : short(token.owner)}</span>
                </span>
              </Link>
              {token.rarity_rank && (
                <span className="item-v3__fact">
                  <span className="tiny muted">{t('rarity.rank')}</span>
                  <RarityRank rank={token.rarity_rank} of={rankOf} variant="chip" />
                </span>
              )}
              <span className="item-v3__fact">
                <span className="tiny muted">{t('item.tokenId')}</span>
                <span className="strong mono-num" title={token.token_id}>#{shortId(token.token_id)}</span>
              </span>
            </div>
          </header>

          <section className="card-v3 price-v3">
            <div className="price-v3__top">
              <div style={{ minWidth: 0 }}>
                <div className="small muted">{t('item.currentPrice')}</div>
                {listed ? (
                  <div className="price-v3__value mono-num">{eth(token.listing_price_wei)} <span>ETH</span></div>
                ) : (
                  <div className="price-v3__value price-v3__value--muted">{t('common.notListed')}</div>
                )}
                {listed && usd(token.listing_price_wei) && <div className="small soft mono-num">≈ {usd(token.listing_price_wei)}</div>}
              </div>
              {listed && token.listing_end_time && <span className="pill pill--outline"><CountdownLabel k="item.endsIn" to={token.listing_end_time} /></span>}
            </div>
            <div className="price-v3__facts">
              <span><span className="muted">{t('col.lastSale')}</span><strong className="mono-num">{token.last_sale_wei ? money(token.last_sale_wei) : '—'}</strong></span>
              <span><span className="muted">{t('common.bestOffer')}</span><strong className="mono-num">{offers[0] ? money(offers[0].price_wei, 'WETH') : '—'}</strong></span>
              <span><span className="muted">{t('common.floor')}</span><strong className="mono-num">{c.floor_wei ? `${eth(c.floor_wei)} ETH` : '—'}</strong></span>
            </div>
            {c.tradable === false ? <div className="notice">{t('col.notTradable')}</div> : (
              <div className="price-v3__actions">
                {mine ? (
                  <>
                    <button className="btn btn--lg" onClick={() => trade.list(c.address, token)}><IconTag size={17} />{listed ? t('item.editPrice') : t('item.list')}</button>
                    {listingOrder && <button className="btn btn--lg btn--outline" onClick={() => trade.cancel(listingOrder, c.address)}>{t('item.cancelListing')}</button>}
                  </>
                ) : (
                  <>
                    {listed && <button className="btn btn--lg" onClick={() => trade.buy(c.address, [token])}>{t('col.buyNow')}</button>}
                    <button className={`btn btn--lg ${listed ? 'btn--outline' : ''}`} onClick={() => trade.offer(c.address, token)}>{t('item.makeOffer')}</button>
                  </>
                )}
              </div>
            )}
          </section>

          <RarityPanel rank={token.rarity_rank} of={rankOf} />

          {traits.length > 0 && (
            <section className="card-v3">
              <header className="card-v3__head">
                <h2 className="card-v3__title">{t('item.traits')} <span className="muted small">{traits.length}</span></h2>
              </header>
              <div className="traits-v3">
                {traits.map((a, i) => (
                  <Link key={`${a.trait_type}-${i}`} className="trait-v3" to={traitLink(a.trait_type, String(a.value))} title={t('item.traitFilter')}>
                    <span className="trait-v3__type">{a.trait_type}</span>
                    <span className="trait-v3__value">{String(a.value)}</span>
                    {a.count !== undefined && a.count > 0 && <TraitShare count={a.count} total={total} />}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="card-v3 item-v3__tabs">
            <Tabs<InfoTab>
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'offers', label: t('item.offers'), count: offers.length },
                { id: 'history', label: t('an.priceHistory') },
                { id: 'details', label: t('item.details') },
              ]}
            />
            <div className="item-v3__tab">
              {tab === 'offers' && (offers.length === 0 ? (
                <div className="item-v3__empty small muted">{t('item.noOffers')}</div>
              ) : (
                <div className="offer-rows">
                  {offers.map((o) => {
                    const byMe = me && o.maker === me;
                    return (
                      <div className="offer-row" key={o.hash}>
                        <div style={{ minWidth: 0 }}>
                          <div className="strong mono-num">{money(o.price_wei, 'WETH')}</div>
                          <div className="tiny muted">
                            {o.kind === 'collection_offer' ? `${t('col.collectionOffer')} · ` : ''}
                            <Link className="link" to={`/profile/${o.maker}`}>{byMe ? t('common.you') : short(o.maker)}</Link> · {timeAgo(o.end_time, lang)}
                          </div>
                        </div>
                        {byMe ? (
                          <button className="btn btn--outline btn--sm" onClick={() => trade.cancel(o, c.address)}>{t('item.cancelOffer')}</button>
                        ) : mine ? (
                          <button className="btn btn--sm" onClick={() => trade.accept(o, c.address, token)}>{t('item.accept')}</button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
              {tab === 'history' && (
                <ChartCard
                  title={t('an.priceHistory')}
                  sub={isUsd ? 'USD' : 'ETH'}
                  empty={!points.length}
                  emptyText={t('item.noSales')}
                  tableLabel={t('an.table')}
                  chartLabel={t('an.chart')}
                  table={{ head: [t('an.time'), t('common.price'), t('common.to')], rows: [...points].reverse().map((p) => [dateTime(new Date(p.t), lang), fmtV(p.v), short(p.label)]) }}
                >
                  <ScatterChart data={points} height={200} t0={t0} t1={t1} fmt={fmtV}
                    fmtT={(ts) => new Date(ts).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', t1 - t0 < 2 * 86400e3 ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' })}
                    tip={(p) => (<><strong>{fmtV(p.v)}</strong><span className="muted">{dateTime(new Date(p.t), lang)}</span></>)} />
                </ChartCard>
              )}
              {tab === 'details' && (
                <dl className="kv item-v3__kv">
                  <div><dt>{t('item.contract')}</dt><dd className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><a className="link" href={explorerCollectionUrl(cfg.explorerUrl, c)} target="_blank" rel="noreferrer">{short(c.address)}</a><CopyButton value={c.address} /></dd></div>
                  <div><dt>{t('item.tokenId')}</dt><dd className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><span title={token.token_id}>{shortId(token.token_id)}</span>{token.token_id.length > 12 && <CopyButton value={token.token_id} />}</dd></div>
                  <div><dt>{t('item.standard')}</dt><dd>ERC-721</dd></div>
                  <div><dt>{t('item.chain')}</dt><dd>{cfg.network?.name || 'GIWA'}</dd></div>
                  <div><dt>{t('common.royalty')}</dt><dd>{c.royalty_bps / 100}%</dd></div>
                  {token.rarity_rank && <div><dt>{t('col.rarity')}</dt><dd>{t('item.rankOf', { rank: token.rarity_rank.toLocaleString(), total: rankOf.toLocaleString() })}</dd></div>}
                  <div><dt>{t('common.explorer')}</dt><dd><a className="link row" style={{ gap: 4 }} href={`${cfg.explorerUrl}/token/${c.address}/instance/${token.token_id}`} target="_blank" rel="noreferrer">GIWA Explorer <IconExternal size={13} /></a></dd></div>
                </dl>
              )}
            </div>
          </section>
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
          {isVideoUrl(token.image_url)
            ? <video src={fixImageUrl(toHttp(token.image_url), cfg.ipfsGateway)} controls autoPlay loop playsInline onClick={(e) => e.stopPropagation()} />
            : <img src={fixImageUrl(toHttp(token.image_url), cfg.ipfsGateway)} alt={title} />}
        </div>
      )}
    </div>
  );
}
