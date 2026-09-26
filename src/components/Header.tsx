import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi';
import { BRAND, GIWA_COWS, activeChain } from '../config';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { eth, short } from '../lib/format';
import { clearSession } from '../lib/session';
import { useTheme } from '../lib/theme';
import type { Collection } from '../lib/types';
import { useAppConfig } from '../lib/appConfig';
import { Avatar, CollectionAvatar } from './Art';
import { IconAlert, IconClose, IconCopy, IconLogout, IconMenu, IconMoon, IconSearch, IconSun, IconUser, IconLock } from './Icons';
import { Badge, useToast } from './ui';
import { useWalletUI } from './wallet';
import { Logo } from './Logo';

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="segmented" role="group" aria-label={t('lang.toggle')}>
      <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
    </div>
  );
}

function SearchBox() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const { data } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get<{ collections: Collection[] }>('/search', { q: debounced }),
    enabled: debounced.length > 0,
  });
  const results = data?.collections ?? [];
  return (
    <div className="header__search" ref={box}>
      <div className="input-wrap">
        <span className="prefix-icon"><IconSearch size={17} /></span>
        <input
          className="input"
          placeholder={t('nav.search')}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) { nav(`/collection/${results[0].slug}`); setOpen(false); setQ(''); }
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-label={t('nav.search')}
        />
      </div>
      {open && debounced && (
        <div className="search-results">
          {results.length === 0 && <div className="small muted" style={{ padding: 12 }}>{t('nav.searchEmpty')}</div>}
          {results.map((c) => (
            <Link key={c.address} to={`/collection/${c.slug}`} onClick={() => { setOpen(false); setQ(''); }}>
              <span className="thumb thumb--sm" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}><span className="strong">{c.name}</span><Badge official={c.is_official} verified={c.verified} size={14} /></span>
                <span className="tiny muted">{t('common.floor')} {eth(c.floor_wei)} ETH</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletButton() {
  const { t } = useI18n();
  const toast = useToast();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { openConnect, forget } = useWalletUI();
  const { data: bal } = useBalance({ address, chainId: activeChain.id, query: { enabled: !!address } });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!isConnected || !address) return <button className="btn btn--sm" onClick={openConnect}>{t('wallet.connect')}</button>;
  if (chainId !== activeChain.id) return <button className="btn btn--sm" onClick={() => switchChain({ chainId: activeChain.id })}>{t('wallet.switch')}</button>;

  return (
    <div className="dropdown" ref={ref}>
      <button className="wallet-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar address={address} size={32} />
        <span className="hide-sm">{short(address)}</span>
      </button>
      {open && (
        <div className="dropdown__menu" role="menu">
          <div className="dropdown__head">
            <div className="tiny muted">{t('wallet.balance')}</div>
            <div className="h3 mono-num">{bal ? eth(bal.value) : '—'} ETH</div>
          </div>
          <Link to={`/profile/${address}`} onClick={() => setOpen(false)}><IconUser size={17} />{t('wallet.profile')}</Link>
          <Link to="/security" onClick={() => setOpen(false)}><IconLock size={17} />{t('sec.menu')}</Link>
          <Link to="/support" onClick={() => setOpen(false)}><IconAlert size={17} />{t('nav.support')}</Link>
          <button onClick={() => { navigator.clipboard?.writeText(address); toast(t('wallet.copied')); setOpen(false); }}><IconCopy size={17} />{t('wallet.copy')}</button>
          <button onClick={() => { clearSession(address); forget(); disconnect(); setOpen(false); }}><IconLogout size={17} />{t('wallet.disconnect')}</button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const { theme, toggle } = useTheme();
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setDrawer(false);
  }, [loc.pathname]);

  const links = [
    { to: `/${GIWA_COWS.slug}`, label: GIWA_COWS.name },
    { to: '/explore', label: t('nav.explore') },
    { to: '/launchpad', label: t('nav.launchpad') },
    { to: '/activity', label: t('nav.activity') },
    { to: '/create', label: t('nav.create') },
  ];

  return (
    <>
      {cfg.loaded && !cfg.ready && <div className="test-banner">{t('banner.notReady')}</div>}
      {cfg.loaded && cfg.chainId !== activeChain.id && (
        <div className="test-banner">
          {t('banner.networkChanged', { name: cfg.network?.name || `chain ${cfg.chainId}` })}{' '}
          <button className="link" style={{ background: 'none', border: 0, color: 'inherit', fontWeight: 700 }} onClick={() => window.location.reload()}>{t('common.reload')}</button>
        </div>
      )}
      <header className="header">
        <div className="container header__inner">
          <Link to="/" className="brand" aria-label={BRAND.name}>
            <Logo size={34} />
            <span className="brand__text">
              <span className="brand__name">{BRAND.name}</span>
              <span className="brand__chain">{BRAND.tagline}</span>
            </span>
          </Link>
          <SearchBox />
          <nav className="nav">
            {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </nav>
          <div className="header__right">
            <span className="hide-sm"><LangToggle /></span>
            <button className="icon-btn" onClick={toggle} aria-label={t('theme.toggle')}>
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
            <WalletButton />
            <button className="icon-btn menu-toggle" onClick={() => setDrawer(true)} aria-label={t('nav.menu')}><IconMenu size={18} /></button>
          </div>
        </div>
      </header>
      {isConnected && chainId !== activeChain.id && (
        <div className="network-bar">
          <div className="container">
            <span>{t('wallet.wrongNetwork', { chain: activeChain.name })}</span>
            <span className="spacer" />
            <button className="btn btn--sm" onClick={() => switchChain({ chainId: activeChain.id })}>{t('wallet.switch')}</button>
          </div>
        </div>
      )}
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <aside className="drawer" aria-label={t('nav.menu')}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <LangToggle />
              <button className="icon-btn" onClick={() => setDrawer(false)} aria-label={t('common.close')}><IconClose size={16} /></button>
            </div>
            <Link to="/">{BRAND.name}</Link>
            {links.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
            <Link to="/support">{t('nav.support')}</Link>
          </aside>
        </>
      )}
    </>
  );
}
