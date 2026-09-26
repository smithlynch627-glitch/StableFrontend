// Shared collection header row (collection page + mint page):
// creator · minted · royalty · (i) description · socials · ⋯ menu.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { activeChain } from '../../config';
import { useI18n } from '../../i18n';
import { collectionAbi } from '../../lib/abis';
import { useAppConfig } from '../../lib/appConfig';
import { explorerCollectionUrl, num, short } from '../../lib/format';
import type { Collection } from '../../lib/types';
import { Avatar } from '../Art';
import { FloatingMenu } from '../Floating';
import { IconAlert, IconCopy, IconExternal, IconInfo, IconShare } from '../Icons';
import { SocialIcon, SocialLink } from '../Social';
import { useToast } from '../ui';

/**
 * Minted count read straight from the contract (refreshes every few seconds), so mint progress, sold-out
 * and phase state never wait for the indexer. Falls back to the indexed count for imported collections.
 */
export function useChainMinted(c: Pick<Collection, 'address' | 'total_supply' | 'max_supply' | 'is_external'>, live = false) {
  const q = useReadContract({
    address: c.address as Address,
    abi: collectionAbi,
    functionName: 'totalMinted',
    chainId: activeChain.id,
    // Every 2 s while minting can still happen, so "sold out" shows almost as soon as the last mint lands.
    query: { enabled: !c.is_external, refetchInterval: live && !(c.max_supply && c.total_supply >= c.max_supply) ? 2_000 : 30_000 },
  });
  const minted = q.data !== undefined ? Math.max(Number(q.data), c.total_supply || 0) : c.total_supply || 0;
  const soldOut = !!c.max_supply && minted >= c.max_supply;
  return { minted, soldOut, refetch: q.refetch };
}

export function CollectionMetaRow({ c, showCollectionLink = false }: { c: Collection; showCollectionLink?: boolean }) {
  const { t, lang } = useI18n();
  const { minted } = useChainMinted(c);
  return (
    <div className="row-wrap small soft col-head__meta">
      {c.is_official && <span className="pill pill--solid">{t('common.official')}</span>}
      {c.creator && (
        <Link to={`/profile/${c.creator}`} className="row" style={{ gap: 6 }}>
          <Avatar address={c.creator} size={20} />
          {t('col.by', { creator: short(c.creator) })}
        </Link>
      )}
      {c.max_supply ? <span className="pill pill--outline">{t('col.minted', { n: num(minted, lang), max: num(c.max_supply, lang) })}</span> : null}
      <span className="pill pill--outline">{t('col.royalty', { pct: c.royalty_bps / 100 })}</span>
      {c.description?.trim() && <DescriptionInfo title={c.name} text={c.description} />}
      {c.twitter && <SocialLink kind="x" href={c.twitter} size={15} />}
      {c.discord && <SocialLink kind="discord" href={c.discord} size={16} />}
      {c.telegram && <SocialLink kind="telegram" href={c.telegram} size={16} />}
      {c.website && <SocialLink kind="website" href={c.website} size={16} />}
      <MoreMenu c={c} showCollectionLink={showCollectionLink} />
    </div>
  );
}

/** (i) button: hover or tap to read the collection description. */
export function DescriptionInfo({ title, text }: { title: string; text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const canHover = () => window.matchMedia('(hover: hover)').matches;
  // The card is placed under the icon and kept fully on screen (phones included).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(360, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - 16 - width));
      setPos({ top: r.bottom + 8, left, width });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div
      className="info-pop"
      ref={ref}
      onMouseEnter={() => canHover() && setOpen(true)}
      onMouseLeave={() => canHover() && setOpen(false)}
    >
      <button ref={btn} type="button" className="icon-btn info-pop__btn" aria-label={t('col.about')} aria-expanded={open} onClick={() => (canHover() ? setOpen(true) : setOpen((o) => !o))}>
        <IconInfo size={17} />
      </button>
      {open && pos && (
        <div className="info-pop__card" role="dialog" aria-label={t('col.about')} style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <div className="strong">{title}</div>
          <p className="small soft">{text}</p>
        </div>
      )}
    </div>
  );
}

export function MoreMenu({ c, showCollectionLink = false }: { c: Collection; showCollectionLink?: boolean }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const link = `${window.location.origin}/collection/${c.slug}`;
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => toast(t('col.linkCopied')));
    setOpen(false);
  };
  const share = async () => {
    setOpen(false);
    if (navigator.share) await navigator.share({ title: c.name, url: link }).catch(() => undefined);
    else copy();
  };
  return (
    <>
      <button ref={btn} className={`icon-btn ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={t('col.moreOptions')} aria-haspopup="menu" aria-expanded={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
      <FloatingMenu anchor={btn} open={open} onClose={close} align="left" minWidth={250} className="menu-list" label={t('col.moreOptions')}>
        {showCollectionLink && (
          <Link to={`/collection/${c.slug}`} role="menuitem" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
            {t('home.viewCollection')}
          </Link>
        )}
        <a href={explorerCollectionUrl(cfg.explorerUrl, c)} target="_blank" rel="noreferrer" role="menuitem" onClick={close}><IconExternal size={16} />{t('col.viewOnChain')}</a>
        <button role="menuitem" onClick={copy}><IconCopy size={16} />{t('col.copyLink')}</button>
        <button role="menuitem" onClick={share}><IconShare size={16} />{t('col.share')}</button>
        <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(c.name)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" role="menuitem" onClick={close}><SocialIcon kind="x" size={16} />{t('col.shareX')}</a>
        <span className="float-menu__sep" aria-hidden="true" />
        <Link to={`/support?category=report&collection=${c.address}`} role="menuitem" className="is-danger" onClick={close}><IconAlert size={16} />{t('col.report')}</Link>
      </FloatingMenu>
    </>
  );
}
