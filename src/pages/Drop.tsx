import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useMoney } from '../lib/currency';
import { useEthPrice, useNetworkFee } from '../lib/live';
import { dateTime, eth, num, tokenLabel } from '../lib/format';
import type { Collection, DropState, Eligibility, Phase, Token } from '../lib/types';
import { CollectionAvatar, CowImage, TokenArt } from '../components/Art';
import { DropStatusPill, phasePrice } from '../components/DropCard';
import { IconArrowLeft, IconArrowRight, IconCheck, IconClock, IconClose, IconLock, IconMinus, IconPlus } from '../components/Icons';
import { ConfigChangedAlert } from '../components/PhaseChanges';
import { CollectionMetaRow, useChainMinted } from '../components/collection/CollectionMeta';
import { RunnerStatus, useRunner } from '../components/trade';
import { Badge, EmptyState, Modal, Progress, Skeleton, useNow } from '../components/ui';
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

function useEligibility(slug: string, address?: string) {
  return useQuery({
    queryKey: ['eligibility', slug.toLowerCase(), address?.toLowerCase()],
    queryFn: () => api.get<{ phases: Eligibility[] }>(`/drops/${slug}/eligibility/${address}`),
    enabled: !!address,
    refetchInterval: 60_000,
  });
}

// ── Big bold countdown ────────────────────────────────────────────────────────
export function BigCountdown({ to, label }: { to: string | number; label: string }) {
  const { t } = useI18n();
  const now = useNow(1000);
  const left = Math.max(0, new Date(to).getTime() - now);
  const s = Math.floor(left / 1000);
  const parts: [number, string][] = [
    [Math.floor(s / 86400), t('drop.unit.d')],
    [Math.floor((s % 86400) / 3600), t('drop.unit.h')],
    [Math.floor((s % 3600) / 60), t('drop.unit.m')],
    [s % 60, t('drop.unit.s')],
  ];
  const shown = parts[0][0] > 0 ? parts : parts.slice(1);
  return (
    <div className="big-timer" role="timer" aria-live="off" aria-label={`${label} ${shown.map(([v, u]) => `${v} ${u}`).join(' ')}`}>
      <span className="big-timer__label"><IconClock size={13} />{label}</span>
      <div className="big-timer__segs">
        {shown.map(([v, unit], i) => (
          <span className="big-timer__seg" key={unit}>
            <span className="big-timer__num mono-num" key={i === shown.length - 1 ? v : undefined}>{String(v).padStart(2, '0')}</span>
            <span className="big-timer__unit">{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Eligibility ───────────────────────────────────────────────────────────────
type EligState = 'open' | 'yes' | 'no' | 'unknown' | 'loading';
function eligibilityOf(p: Phase | null | undefined, connected: boolean, e: Eligibility | undefined, loading: boolean): EligState {
  if (!p) return 'unknown';
  if (!p.hasAllowlist) return 'open';
  if (!connected) return 'unknown';
  if (loading && !e) return 'loading';
  if (!e) return 'unknown';
  return e.eligible ? 'yes' : 'no';
}

function EligibilityBanner({ phase, state }: { phase: Phase; state: EligState }) {
  const { t } = useI18n();
  if (state === 'loading') return <div className="elig elig--wait"><span className="spinner" />{t('common.loading')}</div>;
  if (state === 'unknown') return <div className="elig elig--wait"><IconLock size={16} />{t('drop.checkElig')}</div>;
  const good = state !== 'no';
  return (
    <div className={`elig ${good ? 'elig--good' : 'elig--bad'}`} role="status">
      <span className="elig__icon">{good ? <IconCheck size={15} /> : <IconClose size={15} />}</span>
      <span className="elig__text">
        <span className="strong">{state === 'open' ? t('drop.eligibleOpen', { phase: phase.name }) : state === 'yes' ? t('drop.eligibleFor', { phase: phase.name }) : t('drop.notEligibleFor', { phase: phase.name })}</span>
        {state === 'no' && <span className="small">{t('drop.notEligibleHint')}</span>}
      </span>
    </div>
  );
}

export function EligChip({ state }: { state: EligState }) {
  const { t } = useI18n();
  if (state === 'unknown' || state === 'loading') return null;
  const good = state !== 'no';
  return (
    <span className={`elig-chip ${good ? 'elig-chip--good' : 'elig-chip--bad'}`}>
      {good ? <IconCheck size={12} /> : <IconClose size={12} />}
      {state === 'open' ? t('drop.openShort') : state === 'yes' ? t('drop.eligibleShort') : t('drop.notEligibleShort')}
    </span>
  );
}

/**
 * Drop state worked out in the browser every second from the phase times and the live minted count, so the
 * page flips the moment a phase opens or closes, or the last token is minted (no waiting for the server).
 * Same rules as the contract: a phase is live from its start and closed at its end.
 */
export type LiveDrop = DropState & { minted: number; soldOut: boolean };
export function useLiveDrop(c: Collection, drop: DropState): LiveDrop {
  const tick = useNow(1000);
  const [edgeTick, setEdgeTick] = useState(0);
  const { minted, soldOut: chainSoldOut } = useChainMinted(c, drop.status !== 'ended' && drop.status !== 'sold_out');
  // Re-render exactly when the next phase opens or closes (not up to a second later).
  useEffect(() => {
    const t = Date.now();
    const edges = drop.phases.flatMap((p) => [new Date(p.start).getTime(), p.end ? new Date(p.end).getTime() : Infinity]).filter((x) => x > t && x - t < 2 ** 31 - 1);
    if (!edges.length) return;
    const id = setTimeout(() => setEdgeTick(Date.now()), Math.min(...edges) - t + 15);
    return () => clearTimeout(id);
  }, [drop.phases, edgeTick]);
  const now = Math.max(tick, edgeTick, Date.now());
  return useMemo(() => {
    const soldOut = chainSoldOut || drop.status === 'sold_out';
    const phases = drop.phases.map((p) => {
      const start = new Date(p.start).getTime();
      const end = p.end ? new Date(p.end).getTime() : Infinity;
      const status: Phase['status'] = soldOut || now >= end ? 'ended' : now < start ? 'upcoming' : 'live';
      return status === p.status ? p : { ...p, status };
    });
    const livePhase = phases.find((p) => p.status === 'live') ?? null;
    const nextPhase = phases.find((p) => p.status === 'upcoming') ?? null;
    const status: DropState['status'] = soldOut ? 'sold_out' : livePhase ? 'live' : nextPhase ? 'upcoming' : 'ended';
    return { ...drop, phases, livePhase, nextPhase, status, minted, soldOut };
  }, [drop, now, minted, chainSoldOut]);
}

/** Mint progress, shown above the mint panel. The minted count is read live from the contract. */
export function MintProgress({ c, live = true }: { c: Collection; live?: boolean }) {
  const { t, lang } = useI18n();
  const { minted } = useChainMinted(c, live);
  const max = c.max_supply || 0;
  const pct = max ? Math.min(100, (minted / max) * 100) : 0;
  const left = Math.max(0, max - minted);
  return (
    <section className={`mint-progress ${max && left === 0 ? 'is-full' : ''}`} aria-label={t('drop.progress')}>
      <div className="mint-progress__top">
        <span className="strong">{t('drop.progress')}</span>
        <span className="mint-progress__pct mono-num">{max ? `${pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)}%` : ''}</span>
      </div>
      <Progress value={minted} max={max || 1} />
      <div className="progress-meta">
        <span className="mono-num">{t('lp.minted', { n: num(minted, lang), max: num(max, lang) })}</span>
        <span className="muted">{max ? (left === 0 ? t('lp.soldOut') : t('drop.remaining', { n: num(left, lang) })) : ''}</span>
      </div>
    </section>
  );
}

/** Mint panel. Price, supply and your mint count are read from the contract, not from the API. */
export function MintBox({ c, drop }: { c: Collection; drop: DropState }) {
  const { t } = useI18n();
  const { usd } = useMoney();
  const { address, isConnected, chainId } = useAccount();
  const { openConnect, ensureReady } = useWalletUI();
  const runner = useRunner();
  const [qty, setQty] = useState(1);
  const [modal, setModal] = useState(false);
  const [minted, setMinted] = useState<string[]>([]);
  const colAddr = c.address as Address;
  const d = useLiveDrop(c, drop);
  const live = d.livePhase;
  const next = d.nextPhase;
  const shown = live || next;
  const closed = d.status === 'sold_out' || d.status === 'ended';

  const phasesQ = useReadContract({ address: colAddr, abi: collectionAbi, functionName: 'getPhases', chainId: activeChain.id, query: { refetchInterval: 20_000 } });
  const mineQ = useReadContract({
    address: colAddr, abi: collectionAbi, functionName: 'mintedInPhase', chainId: activeChain.id,
    args: [BigInt(live?.index ?? 0), (address ?? '0x0000000000000000000000000000000000000000') as Address],
    query: { enabled: !!address && !!live, refetchInterval: 10_000 },
  });
  const elig = useEligibility(c.slug, address);

  const chainPhase = live ? phasesQ.data?.[live.index] : undefined;
  const price = chainPhase ? chainPhase.price : shown ? BigInt(shown.priceWei) : 0n;
  const maxPerWallet = chainPhase ? Number(chainPhase.maxPerWallet) : shown?.maxPerWallet ?? 0;
  const totalMinted = d.minted;
  const mine = Number(mineQ.data ?? 0n);
  const myLive = live ? elig.data?.phases[live.index] : undefined;
  const remaining = c.max_supply ? c.max_supply - totalMinted : 50;
  const walletLeft = maxPerWallet ? maxPerWallet - mine : 50;
  const maxQty = Math.max(0, Math.min(remaining, walletLeft, 50));
  const q = Math.min(qty, Math.max(1, maxQty));
  const total = price * BigInt(q);
  const eligState = eligibilityOf(shown, isConnected, shown ? elig.data?.phases[shown.index] : undefined, elig.isLoading);

  let blocker: string | null = null;
  if (d.soldOut || remaining <= 0) blocker = t('drop.soldOut');
  else if (!live) blocker = next ? t('drop.notLive') : t('drop.ended');
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
    const out = await runner.run((ctx) => mint(ctx, { collection: c.address, phaseIndex: live.index, quantity: q, proof: myLive?.proof ?? [], expectedPriceWei: price }));
    if (out) {
      setMinted(out.tokenIds);
      setQty(1);
    }
  }

  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(t('drop.shareText', { name: c.name }))}&url=${encodeURIComponent(`${window.location.origin}/launchpad/${c.slug}`)}`;
  const priceUsd = price > 0n ? usd(price) : null;
  const close = () => { setModal(false); runner.reset(); };

  return (
    <div className={`mint-box ${live ? 'is-live' : ''} ${closed ? 'is-closed' : ''}`}>
      {closed && (
        <div className="mint-box__closed">
          <span className="eyebrow">{d.soldOut ? t('lp.soldOut') : t('lp.ended')}</span>
          <span className="mint-box__phase-name">{d.soldOut ? t('drop.soldOutTitle', { n: num(c.max_supply || d.minted) }) : t('drop.ended')}</span>
          <span className="small soft">{t('drop.closedBody')}</span>
          <Link className="btn btn--lg btn--block" to={`/collection/${c.slug}`}>{t('drop.buyOnMarket')}</Link>
        </div>
      )}
      {!closed && shown && (
        <div className="mint-box__phase">
          <div className="mint-box__phase-info">
            <span className="eyebrow">{live ? <><span className="live-dot" />{t('drop.nowLive')}</> : t('drop.upNext')}</span>
            <span className="mint-box__phase-name">{shown.name}</span>
            <span className="small soft">{shown.hasAllowlist ? t('drop.allowlist') : t('drop.open')} · {shown.maxPerWallet ? t('drop.limit', { n: shown.maxPerWallet }) : t('drop.noLimit')}</span>
          </div>
          {live ? (live.end ? <BigCountdown to={live.end} label={t('drop.endsInLabel')} /> : <span className="pill pill--outline">{t('phase.untilSoldOut')}</span>)
            : next && <BigCountdown to={next.start} label={t('drop.startsInLabel')} />}
        </div>
      )}

      {!closed && shown && <EligibilityBanner phase={shown} state={eligState} />}

      {!closed && <div className="mint-box__price">
        <div>
          <div className="small muted">{t('drop.price')}</div>
          <div className="mint-box__amount mono-num">{price === 0n ? t('lp.free') : `${eth(price, 6)} ETH`}</div>
          {priceUsd && <div className="small soft mono-num">≈ {priceUsd}</div>}
        </div>
        {live && (
          <div className="stepper" role="group" aria-label={t('common.quantity')}>
            <button onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1} aria-label="-"><IconMinus size={16} /></button>
            <output aria-live="polite">{q}</output>
            <button onClick={() => setQty(Math.min(Math.max(1, maxQty), q + 1))} disabled={q >= maxQty} aria-label="+"><IconPlus size={16} /></button>
          </div>
        )}
      </div>}

      {live && (
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
      )}

      {closed ? null : !isConnected ? (
        <button className="btn btn--lg btn--block" onClick={openConnect}>{t('drop.connect')}</button>
      ) : chainId !== activeChain.id ? (
        <button className="btn btn--lg btn--block" onClick={() => ensureReady()}>{t('wallet.switch')}</button>
      ) : blocker ? (
        <button className="btn btn--lg btn--block" disabled>{blocker}</button>
      ) : (
        <button className="btn btn--lg btn--block mint-box__cta" onClick={onMint} disabled={!myLive}>{q > 1 ? t('drop.mintN', { n: q }) : t('drop.mint')}</button>
      )}
      {!closed && isConnected && live && maxPerWallet ? (
        <div className="row small soft" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>{t('drop.youMinted', { n: mine, max: maxPerWallet })}</span>
          <span className="strong">{t('drop.walletLeft', { n: Math.max(0, walletLeft) })}</span>
        </div>
      ) : null}

      <Modal open={modal} onClose={close} title={t('drop.mint')} locked={runner.busy} width={minted.length ? 500 : 440}>
        <RunnerStatus
          runner={runner}
          successText={t('drop.successTitle')}
          onClose={close}
          extra={
            <div style={{ display: 'grid', gap: 14 }}>
              <p className="soft" style={{ margin: 0 }}>{t('drop.successBody', { n: minted.length })}</p>
              {minted.length > 0 && <MintedCarousel c={c} ids={minted} />}
              <div className="row">
                {address && <Link className="btn btn--outline" style={{ flex: 1 }} to={`/profile/${address}`} onClick={close}>{t('drop.viewItems')}</Link>}
                <a className="btn btn--outline" style={{ flex: 1 }} href={shareUrl} target="_blank" rel="noreferrer"><SocialIcon kind="x" size={14} />{t('drop.share')}</a>
              </div>
            </div>
          }
        />
      </Modal>
    </div>
  );
}

// ── Freshly minted items: square cards, swipe on touch, arrows + dots on desktop ──
function MintedCarousel({ c, ids }: { c: Collection; ids: string[] }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const count = ids.length;
  const go = (n: number) => {
    const el = ref.current;
    if (!el) return;
    const k = Math.max(0, Math.min(count - 1, n));
    el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' });
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="minted" aria-roledescription="carousel">
      <div
        className="minted__track"
        ref={ref}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
        }}
      >
        {ids.map((id, k) => <MintedSlide key={id} c={c} id={id} label={t('drop.slide', { n: k + 1, total: count })} />)}
      </div>
      {count > 1 && (
        <>
          <button type="button" className="minted__nav minted__nav--prev" onClick={() => go(i - 1)} disabled={i === 0} aria-label={t('drop.prev')}><IconArrowLeft size={18} /></button>
          <button type="button" className="minted__nav minted__nav--next" onClick={() => go(i + 1)} disabled={i >= count - 1} aria-label={t('drop.next')}><IconArrowRight size={18} /></button>
          <div className="minted__foot">
            {count <= 12 ? (
              <div className="minted__dots" role="tablist">
                {ids.map((id, k) => <button key={id} type="button" role="tab" aria-selected={k === i} aria-label={t('drop.slide', { n: k + 1, total: count })} onClick={() => go(k)} />)}
              </div>
            ) : <span />}
            <span className="small mono-num muted">{t('drop.slide', { n: i + 1, total: count })}</span>
          </div>
        </>
      )}
    </div>
  );
}

function MintedSlide({ c, id, label }: { c: Collection; id: string; label: string }) {
  // The indexer usually has the metadata within a few seconds; retry quietly until it does.
  const q = useQuery({
    queryKey: ['token', c.slug.toLowerCase(), id],
    queryFn: () => api.get<{ token: Token }>(`/tokens/${c.slug}/${id}`),
    retry: 8,
    retryDelay: 2500,
  });
  const token = q.data?.token;
  return (
    <Link to={`/item/${c.slug}/${id}`} className="minted__slide" aria-roledescription="slide" aria-label={label}>
      <span className="minted__art"><TokenArt collection={c} token={token ?? { token_id: id }} /></span>
      <span className="minted__cap">
        <span className="strong ellipsis">{tokenLabel(token?.name, id)}</span>
        <span className="small muted ellipsis">{c.name}</span>
      </span>
    </Link>
  );
}

export default function DropPage() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const q = useDrop(slug);
  if (q.isLoading) return <div className="page container drop-layout"><Skeleton h={520} r={22} /><Skeleton h={520} r={22} /></div>;
  if (!q.data) return <div className="page container"><div className="back-row"><BackButton fallback="/launchpad" /></div><EmptyState title={t('drop.notFound')} action={<Link className="btn" to="/launchpad">{t('lp.title')}</Link>} /></div>;
  return <DropView c={q.data.collection} drop={q.data.drop} refetch={q.refetch} />;
}

function DropView({ c, drop, refetch }: { c: Collection; drop: DropState; refetch: () => unknown }) {
  const { t, lang } = useI18n();
  const { isConnected, address } = useAccount();
  const elig = useEligibility(c.slug, address);
  const d = useLiveDrop(c, drop);
  const lowest = d.phases.reduce<bigint | null>((m, p) => (m === null || BigInt(p.priceWei) < m ? BigInt(p.priceWei) : m), null);

  // When a phase opens/closes or the drop sells out, the page has already flipped; also refresh the server copy.
  const edge = `${d.status}:${d.livePhase?.index ?? '-'}`;
  const firstEdge = useRef(edge);
  useEffect(() => {
    if (edge !== firstEdge.current) refetch();
  }, [edge]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page container drop-page">
      <div className="back-row"><BackButton fallback="/launchpad" /></div>
      <div className="drop-layout">
        <div className="drop-media">
          <div className="drop-media__main">
            <CollectionAvatar collection={c} />
            <span className="drop-media__pill"><DropStatusPill d={d} /></span>
          </div>
          {c.art_style === 'cow' && (
            <div className="drop-media__strip" aria-label={t('drop.preview')}>
              {[1, 4, 8, 12].map((i) => <div key={i} style={{ position: 'relative' }}><CowImage index={i} /></div>)}
            </div>
          )}
          <div className="drop-facts">
            <span><span className="tiny muted">{t('drop.supply')}</span><strong className="mono-num">{num(c.max_supply, lang)}</strong></span>
            <span><span className="tiny muted">{t('drop.minted')}</span><strong className="mono-num">{num(d.minted, lang)}</strong></span>
            <span><span className="tiny muted">{t('drop.price')}</span><strong className="mono-num">{lowest === null ? '—' : lowest === 0n ? t('lp.free') : `${eth(lowest, 6)} ETH`}</strong></span>
            <span><span className="tiny muted">{t('drop.phases')}</span><strong className="mono-num">{d.phases.length}</strong></span>
          </div>
        </div>

        <div className="drop-main">
          <div className="drop-head">
            <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}><h1 className="h1">{c.name}</h1><Badge official={c.is_official} verified={c.verified} size={24} /></div>
            <CollectionMetaRow c={c} showCollectionLink />
          </div>

          <ConfigChangedAlert collection={c.address} changes={drop.changes} />

          <MintProgress c={c} live={d.status === 'live' || d.status === 'upcoming'} />
          <MintBox c={c} drop={drop} />

          <section className="drop-phases">
            <header className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="h3">{t('drop.phases')}</h2>
              <span className="small muted">{t('drop.allPhases', { n: d.phases.length })}</span>
            </header>
            <ol className="phase-line">
              {d.phases.map((p, i) => (
                <PhaseRow key={p.id ?? p.index} p={p} n={i + 1} last={i === d.phases.length - 1}
                  state={eligibilityOf(p, isConnected, elig.data?.phases[p.index], elig.isLoading)} />
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

export function PhaseRow({ p, n, last, state }: { p: Phase; n: number; last: boolean; state: EligState }) {
  const { t, lang } = useI18n();
  return (
    <li className={`phase-line__item is-${p.status}`}>
      <span className="phase-line__dot" aria-hidden>{p.status === 'ended' ? <IconCheck size={12} /> : last && !p.hasAllowlist ? <IconLock size={11} /> : n}</span>
      <div className="phase-line__card">
        <div className="phase-line__head">
          <span className="phase-line__name">{p.name}</span>
          {p.status === 'live' && <span className="pill pill--live">{t('lp.live')}</span>}
          {p.status === 'upcoming' && <span className="pill pill--outline">{t('lp.upcoming')}</span>}
          {p.status === 'ended' && <span className="pill">{t('lp.ended')}</span>}
          <span style={{ flex: 1 }} />
          {p.status !== 'ended' && <EligChip state={state} />}
        </div>
        <div className="phase-line__grid">
          <span><span className="tiny muted">{t('drop.price')}</span><strong className="mono-num">{phasePrice(p.priceWei, t('lp.free'))}</strong></span>
          <span><span className="tiny muted">{t('create.maxPerWallet')}</span><strong>{p.maxPerWallet ? num(p.maxPerWallet, lang) : '∞'}</strong></span>
          <span><span className="tiny muted">{t('phase.access')}</span><strong>{p.hasAllowlist ? t('phase.allowlist') : t('phase.open')}</strong></span>
        </div>
        <div className="phase-line__time">
          {p.status === 'upcoming' && <><span className="muted small">{t('drop.startsInLabel')}</span><PhaseTimer to={p.start} /></>}
          {p.status === 'live' && (p.end ? <><span className="muted small">{t('drop.endsInLabel')}</span><PhaseTimer to={p.end} /></> : <span className="small strong">{t('phase.untilSoldOut')}</span>)}
          <span className="tiny muted phase-line__dates">{dateTime(p.start, lang)}{p.end ? ` – ${dateTime(p.end, lang)}` : ''}</span>
        </div>
      </div>
    </li>
  );
}

function PhaseTimer({ to }: { to: string }) {
  const now = useNow(1000);
  const left = Math.max(0, new Date(to).getTime() - now);
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
  return <span className="phase-line__timer mono-num">{d > 0 ? `${d}d ${hms}` : hms}</span>;
}
