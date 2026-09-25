import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { encodeFunctionData, type Address } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { activeChain } from '../config';
import { useI18n } from '../i18n';
import { SocialIcon } from '../components/Social';
import { api } from '../lib/api';
import { collectionAbi } from '../lib/abis';
import { mint } from '../lib/actions';
import { useEthPrice, useNetworkFee } from '../lib/live';
import { dateTime, eth, num, short } from '../lib/format';
import type { Collection, DropState, Eligibility, Phase } from '../lib/types';
import { Avatar, CollectionAvatar, CowImage, TokenArt } from '../components/Art';
import { DropStatusPill, phasePrice } from '../components/DropCard';
import { IconCheck, IconClose, IconMinus, IconPlus } from '../components/Icons';
import { RunnerStatus, useRunner } from '../components/trade';
import { Badge, CountdownLabel, EmptyState, Modal, Progress, Skeleton } from '../components/ui';
import { useWalletUI } from '../components/wallet';
import { BackButton } from '../components/BackButton';

export function useDrop(slug: string) {
  return useQuery({
    queryKey: ['drop', slug.toLowerCase()],
    queryFn: () => api.get<{ collection: Collection; drop: DropState }>(`/drops/${slug}`),
    refetchInterval: 15_000,
    retry: (n, e: any) => e?.status !== 404 && n < 2,
  });
}

/** Mint panel. Price, supply and your mint count are read from the contract, not from the API. */
export function MintBox({ c, drop }: { c: Collection; drop: DropState }) {
  const { t, lang } = useI18n();
  const { address, isConnected, chainId } = useAccount();
  const { openConnect, ensureReady } = useWalletUI();
  const runner = useRunner();
  const [qty, setQty] = useState(1);
  const [modal, setModal] = useState(false);
  const [minted, setMinted] = useState<string[]>([]);
  const colAddr = c.address as Address;
  const live = drop.livePhase;

  const phasesQ = useReadContract({ address: colAddr, abi: collectionAbi, functionName: 'getPhases', chainId: activeChain.id, query: { refetchInterval: 20_000 } });
  const totalQ = useReadContract({ address: colAddr, abi: collectionAbi, functionName: 'totalMinted', chainId: activeChain.id, query: { refetchInterval: 6_000 } });
  const mineQ = useReadContract({
    address: colAddr, abi: collectionAbi, functionName: 'mintedInPhase', chainId: activeChain.id,
    args: [BigInt(live?.index ?? 0), (address ?? '0x0000000000000000000000000000000000000000') as Address],
    query: { enabled: !!address && !!live },
  });
  const elig = useQuery({
    queryKey: ['eligibility', c.slug, address],
    queryFn: () => api.get<{ phases: Eligibility[] }>(`/drops/${c.slug}/eligibility/${address}`),
    enabled: !!address,
  });

  const chainPhase = live ? phasesQ.data?.[live.index] : undefined;
  const price = chainPhase ? chainPhase.price : live ? BigInt(live.priceWei) : 0n;
  const maxPerWallet = chainPhase ? Number(chainPhase.maxPerWallet) : live?.maxPerWallet ?? 0;
  const totalMinted = totalQ.data !== undefined ? Number(totalQ.data) : c.total_supply;
  const mine = Number(mineQ.data ?? 0n);
  const myLive = live ? elig.data?.phases[live.index] : undefined;
  const remaining = c.max_supply ? c.max_supply - totalMinted : 50;
  const walletLeft = maxPerWallet ? maxPerWallet - mine : 50;
  const maxQty = Math.max(0, Math.min(remaining, walletLeft, 50));
  const q = Math.min(qty, Math.max(1, maxQty));
  const total = price * BigInt(q);

  let blocker: string | null = null;
  if (drop.status === 'sold_out' || remaining <= 0) blocker = t('drop.soldOut');
  else if (!live) blocker = t('drop.notLive');
  else if (isConnected && myLive && !myLive.eligible) blocker = t('drop.notEligible');
  else if (isConnected && maxPerWallet && walletLeft <= 0) blocker = t('drop.limitReached');

  const canEstimate = isConnected && chainId === activeChain.id && !!live && !blocker && !!myLive;
  const fee = useNetworkFee(
    canEstimate
      ? {
          account: address,
          to: colAddr,
          data: encodeFunctionData({ abi: collectionAbi, functionName: 'mint', args: [BigInt(live!.index), BigInt(q), myLive!.proof] }),
          value: total,
        }
      : null,
  );
  const ethUsd = useEthPrice().data?.usd;

  async function onMint() {
    if (!live) return;
    if (!(await ensureReady())) return;
    setModal(true);
    setMinted([]);
    const out = await runner.run((ctx) => mint(ctx, { collection: c.address, phaseIndex: live.index, quantity: q, proof: myLive?.proof ?? [] }));
    if (out) {
      setMinted(out.tokenIds);
      setQty(1);
    }
  }

  const creatorPct = 100 - drop.platformFeeBps / 100;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(t('drop.shareText', { name: c.name }))}&url=${encodeURIComponent(window.location.href)}`;

  return (
    <div className="mint-box">
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="strong">{t('drop.progress')}</span>
          <span className="small muted">{c.max_supply ? t('drop.remaining', { n: num(Math.max(0, remaining), lang) }) : ''}</span>
        </div>
        <Progress value={totalMinted} max={c.max_supply || 1} />
        <div className="progress-meta">
          <span>{t('lp.minted', { n: num(totalMinted, lang), max: num(c.max_supply, lang) })}</span>
          <span className="muted">{c.max_supply ? `${Math.floor((totalMinted / c.max_supply) * 100)}%` : ''}</span>
        </div>
      </div>

      {live && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div className="small muted">{live.name}</div>
              <div className="h2 mono-num">{price === 0n ? t('lp.free') : `${eth(price, 6)} ETH`}</div>
            </div>
            <div className="stepper" role="group" aria-label={t('common.quantity')}>
              <button onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1} aria-label="-"><IconMinus size={16} /></button>
              <output aria-live="polite">{q}</output>
              <button onClick={() => setQty(Math.min(Math.max(1, maxQty), q + 1))} disabled={q >= maxQty} aria-label="+"><IconPlus size={16} /></button>
            </div>
          </div>
          <div className="sum-rows">
            <div><span className="muted">{t('common.price')}</span><span className="mono-num">{price === 0n ? t('lp.free') : `${eth(price, 6)} × ${q}`}</span></div>
            {fee.data !== undefined && (
              <div>
                <span className="muted">{t('fee.network')}</span>
                <span className="mono-num">≈ {(Number(fee.data) / 1e18).toPrecision(2)} ETH{ethUsd ? ` ($${((Number(fee.data) / 1e18) * ethUsd).toFixed(4)})` : ''}</span>
              </div>
            )}
            <div className="total"><span>{t('common.total')}</span><span className="mono-num">{total === 0n ? t('lp.free') : `${eth(total, 6)} ETH`}</span></div>
          </div>
          {isConnected && maxPerWallet ? <div className="small soft">{t('drop.youMinted', { n: mine, max: maxPerWallet })}</div> : null}
        </>
      )}

      {!isConnected ? (
        <button className="btn btn--lg btn--block" onClick={openConnect}>{t('drop.connect')}</button>
      ) : chainId !== activeChain.id ? (
        <button className="btn btn--lg btn--block" onClick={() => ensureReady()}>{t('wallet.switch')}</button>
      ) : blocker ? (
        <button className="btn btn--lg btn--block" disabled>{blocker}</button>
      ) : (
        <button className="btn btn--lg btn--block" onClick={onMint} disabled={!myLive}>{q > 1 ? t('drop.mintN', { n: q }) : t('drop.mint')}</button>
      )}
      <p className="tiny muted">{t('drop.split', { creator: creatorPct, platform: drop.platformFeeBps / 100 })} {t('fee.wallet')}</p>

      <Modal open={modal} onClose={() => { setModal(false); runner.reset(); }} title={t('drop.mint')} locked={runner.busy} width={minted.length ? 560 : 440}>
        <RunnerStatus
          runner={runner}
          successText={t('drop.successTitle')}
          onClose={() => { setModal(false); runner.reset(); }}
          extra={
            <div style={{ display: 'grid', gap: 14 }}>
              <p className="soft">{t('drop.successBody', { n: minted.length })}</p>
              {minted.length > 0 && (
                <div className="nft-grid nft-grid--small" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {minted.slice(0, 12).map((id) => (
                    <Link key={id} to={`/item/${c.slug}/${id}`} className="nft-card">
                      <div className="nft-card__media"><TokenArt collection={c} token={{ token_id: id }} /></div>
                      <div className="nft-card__body"><div className="nft-card__name">#{id}</div></div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="row">
                {address && <Link className="btn btn--outline" style={{ flex: 1 }} to={`/profile/${address}`}>{t('drop.viewItems')}</Link>}
                <a className="btn btn--outline" style={{ flex: 1 }} href={shareUrl} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={14} />{t('drop.share')}</a>
              </div>
            </div>
          }
        />
      </Modal>
    </div>
  );
}

export default function DropPage() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const { isConnected, address } = useAccount();
  const q = useDrop(slug);
  const elig = useQuery({
    queryKey: ['eligibility', slug.toLowerCase(), address],
    queryFn: () => api.get<{ phases: Eligibility[] }>(`/drops/${slug}/eligibility/${address}`),
    enabled: !!address && !!q.data,
  });

  if (q.isLoading) return <div className="page container drop-layout"><Skeleton h={520} r={22} /><Skeleton h={520} r={22} /></div>;
  if (!q.data) return <div className="page container"><div className="back-row"><BackButton fallback="/launchpad" /></div><EmptyState title={t('drop.notFound')} action={<Link className="btn" to="/launchpad">{t('lp.title')}</Link>} /></div>;
  const { collection: c, drop } = q.data;

  return (
    <div className="page container">
      <div className="back-row"><BackButton fallback="/launchpad" /></div>
      <div className="drop-layout">
        <div className="drop-media">
          <div className="drop-media__main" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></div>
          {c.art_style === 'cow' && (
            <div className="drop-media__strip" aria-label={t('drop.preview')}>
              {[1, 4, 8, 12].map((i) => <div key={i} style={{ position: 'relative' }}><CowImage index={i} /></div>)}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="row-wrap"><DropStatusPill d={drop} />{c.is_official && <span className="pill pill--solid">{t('common.official')}</span>}</div>
            <div className="row" style={{ gap: 8 }}><h1 className="h1">{c.name}</h1><Badge official={c.is_official} verified={c.verified} size={24} /></div>
            {c.creator && (
              <Link to={`/profile/${c.creator}`} className="row small soft" style={{ gap: 8 }}>
                <Avatar address={c.creator} size={22} />{t('col.by', { creator: short(c.creator) })}
              </Link>
            )}
            {c.description && <p className="soft" style={{ maxWidth: '62ch' }}>{c.description}</p>}
            <div className="row-wrap">
              <Link to={`/collection/${c.slug}`} className="btn btn--outline btn--sm">{t('home.viewCollection')}</Link>
              {c.twitter && <a className="icon-btn" href={c.twitter} target="_blank" rel="noreferrer" aria-label="X"><SocialIcon kind="x" size={15} /></a>}
            </div>
          </div>

          <MintBox c={c} drop={drop} />

          <div style={{ display: 'grid', gap: 12 }}>
            <h2 className="h3">{t('drop.phases')}</h2>
            {drop.phases.map((p) => <PhaseRow key={p.index} p={p} e={elig.data?.phases[p.index]} connected={isConnected} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhaseRow({ p, e, connected }: { p: Phase; e?: Eligibility; connected: boolean }) {
  const { t, lang } = useI18n();
  return (
    <div className={`phase ${p.status === 'live' ? 'is-live' : ''} ${p.status === 'ended' ? 'is-ended' : ''}`}>
      <div className="phase__row">
        <div className="row" style={{ gap: 8 }}>
          <span className="strong">{p.name}</span>
          {p.status === 'live' && <span className="pill pill--live">{t('lp.live')}</span>}
          {p.status === 'upcoming' && <span className="pill">{t('lp.upcoming')}</span>}
          {p.status === 'ended' && <span className="pill">{t('lp.ended')}</span>}
        </div>
        <span className="strong mono-num">{phasePrice(p.priceWei, t('lp.free'))}</span>
      </div>
      <div className="phase__row small soft">
        <span>{p.hasAllowlist ? t('drop.allowlist') : t('drop.open')}</span>
        <span>{p.maxPerWallet ? t('drop.limit', { n: p.maxPerWallet }) : t('drop.noLimit')}</span>
      </div>
      <div className="phase__row small">
        <span className="muted">
          {p.status === 'upcoming' && <CountdownLabel k="lp.startsIn" to={p.start} />}
          {p.status === 'live' && p.end && <CountdownLabel k="lp.endsIn" to={p.end} />}
          {p.status === 'ended' && `${dateTime(p.start, lang)} – ${p.end ? dateTime(p.end, lang) : ''}`}
        </span>
        {connected && e && p.hasAllowlist && p.status !== 'ended' && (
          <span className="row strong" style={{ gap: 4 }}>
            {e.eligible ? <IconCheck size={15} /> : <IconClose size={15} />}
            {e.eligible ? t('drop.eligible') : t('drop.notEligible')}
          </span>
        )}
      </div>
    </div>
  );
}
