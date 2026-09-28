// Connect X: links the creator's X account to their wallet (OAuth on the API). Only the @username is used.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { getSession } from '../lib/session';
import { useAuthedApi } from '../lib/tx';
import { errorMessage } from '../lib/actions';
import { SocialIcon } from './Social';
import { IconAlert, IconCheck, IconLock } from './Icons';
import { useToast } from './ui';
import { useWalletUI } from './wallet';

export interface XMe { enabled: boolean; connected: boolean; username: string | null; connectedAt: string | null }
export const X_MESSAGE = 'stable:x-connected';
export const X_CHANNEL = 'stable-x';
export const X_STORAGE = 'stable.x.result';

/** The signed-in wallet's connected X account (null while signed out or not connected). */
export function useXAccount(pollMs: number | false = false) {
  const { address } = useAccount();
  const cfg = useAppConfig();
  const [signedIn, setSignedIn] = useState(() => !!getSession(address));
  useEffect(() => setSignedIn(!!getSession(address)), [address]);
  const q = useQuery({
    queryKey: ['x-me', address?.toLowerCase() ?? ''],
    queryFn: async () => {
      const token = getSession(address);
      if (!token) return null;
      return api.get<XMe>('/x/me', undefined, token).catch((e) => (e?.status === 401 ? null : Promise.reject(e)));
    },
    enabled: !!address && cfg.xConnect === true && signedIn,
    refetchOnWindowFocus: true,
    refetchInterval: pollMs,
    staleTime: 5_000,
  });
  const username = q.data?.connected ? q.data.username : null;
  return { username, query: q, signedIn, markSignedIn: () => setSignedIn(true), enabled: cfg.xConnect === true, configLoaded: cfg.loaded };
}

const POPUP = 'width=560,height=720,menubar=no,toolbar=no,location=yes,status=no';

/**
 * Connect-X card. Opens X in a small window; the API reads the @username once and forgets the X token.
 * `returnPath` is where a full-page fallback (popup blocked) comes back to.
 */
export function XConnect({ returnPath, onChange, onBeforeRedirect }: { returnPath: string; onChange?: (username: string | null) => void; onBeforeRedirect?: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const authed = useAuthedApi();
  const { address, isConnected } = useAccount();
  const { openConnect } = useWalletUI();
  const [waiting, setWaiting] = useState(false);
  const x = useXAccount(waiting ? 2500 : false);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const popup = useRef<Window | null>(null);
  const started = useRef(0);
  const seen = useRef(0);

  useEffect(() => { onChange?.(x.username); }, [x.username]); // eslint-disable-line react-hooks/exhaustive-deps

  const xKey = ['x-me', address?.toLowerCase() ?? ''];
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['x-me', address?.toLowerCase() ?? ''] }), [qc, address]);
  // Drop any in-flight status check, so an older answer can't be taken for the new connection.
  const forget = async () => {
    await qc.cancelQueries({ queryKey: xKey });
    qc.setQueryData<XMe | null>(xKey, (d) => (d ? { ...d, connected: false, username: null } : d));
  };

  // Connected while we were waiting: the API is the source of truth (the X window's message is only a hint).
  useEffect(() => {
    if (!waiting || !x.username) return;
    setWaiting(false);
    try { popup.current?.close(); } catch {}
    toast(t('x.connectedToast', { user: `@${x.username}` }));
  }, [waiting, x.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // The X window reports back through postMessage, BroadcastChannel or storage (whichever survives the trip through x.com).
  useEffect(() => {
    const handle = (data: any) => {
      if (data?.type !== X_MESSAGE || Number(data.at) < started.current - 1000 || Number(data.at) === seen.current) return;
      seen.current = Number(data.at); // the same result can arrive by several routes
      if (data.status === 'ok') { x.markSignedIn(); refresh(); return; }
      setWaiting(false);
      toast(t(data.status === 'denied' ? 'x.denied' : data.status === 'expired' ? 'x.expired' : 'x.failed'), 'error');
    };
    const onMsg = (e: MessageEvent) => { if (e.origin === window.location.origin) handle(e.data); };
    const onStorage = (e: StorageEvent) => { if (e.key === X_STORAGE && e.newValue) { try { handle(JSON.parse(e.newValue)); } catch {} } };
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel(X_CHANNEL); bc.onmessage = (e) => handle(e.data); } catch {}
    window.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); bc?.close(); };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop waiting after the 10-minute lifetime of the X link.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setWaiting(false), 10 * 60_000);
    return () => window.clearTimeout(id);
  }, [waiting]);

  async function connect() {
    if (!address) return openConnect();
    // Open the window inside the click so popup blockers allow it; X's page is loaded once the link is ready.
    const w = getSession(address) ? window.open('', 'stable-x', POPUP) : null;
    if (w) {
      try { w.document.title = 'Connecting X…'; w.document.body.style.cssText = 'font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0'; w.document.body.textContent = 'Opening X…'; } catch {}
    }
    setBusy('connect');
    started.current = Date.now();
    try {
      if (!w) {
        // First sign-in on this device: this wallet may have connected X before, then there is nothing to do.
        const me = await authed.get<XMe>('/x/me');
        x.markSignedIn();
        qc.setQueryData(xKey, me);
        if (me.connected) return;
      }
      await forget();
      const { url } = await authed.post<{ url: string }>('/x/start', { returnPath });
      x.markSignedIn();
      if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('Unexpected X link');
      const target = w && !w.closed ? w : window.open('', 'stable-x', POPUP);
      if (target) {
        target.location.href = url;
        popup.current = target;
        setWaiting(true);
      } else {
        onBeforeRedirect?.();
        window.location.assign(url);
      }
    } catch (e) {
      try { w?.close(); } catch {}
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    try {
      await qc.cancelQueries({ queryKey: xKey });
      await authed.del('/x');
      await forget();
      await refresh();
    } catch (e) {
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (x.configLoaded && !x.enabled) {
    return (
      <div className="xc xc--off" role="status">
        <span className="xc__logo"><SocialIcon kind="x" size={20} /></span>
        <div className="xc__text"><span className="strong">{t('x.offTitle')}</span><span className="small soft">{t('x.offBody')}</span></div>
      </div>
    );
  }

  if (x.username) {
    return (
      <div className="xc xc--ok">
        <span className="xc__logo"><SocialIcon kind="x" size={20} /></span>
        <div className="xc__text">
          <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <a className="strong xc__user" href={`https://x.com/${x.username}`} target="_blank" rel="noreferrer">@{x.username}</a>
            <span className="xc__badge"><IconCheck size={12} />{t('x.connected')}</span>
          </span>
          <span className="tiny muted">{t('x.privacy')}</span>
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={disconnect} disabled={!!busy}>{busy === 'disconnect' && <span className="spinner" />}{t('x.change')}</button>
      </div>
    );
  }

  return (
    <div className={`xc${waiting ? ' is-waiting' : ''}`}>
      <span className="xc__logo"><SocialIcon kind="x" size={20} /></span>
      <div className="xc__text">
        <span className="strong">{waiting ? t('x.waiting') : t('x.title')}</span>
        <span className="small soft">{t('x.body')}</span>
        <span className="tiny muted row" style={{ gap: 5 }}><IconLock size={12} />{t('x.privacy')}</span>
      </div>
      {!isConnected ? (
        <button type="button" className="btn btn--sm" onClick={openConnect}>{t('wallet.connect')}</button>
      ) : (
        <button type="button" className="btn btn--sm xc__btn" onClick={connect} disabled={busy === 'connect'}>
          {busy === 'connect' || waiting ? <span className="spinner" /> : <SocialIcon kind="x" size={14} />}
          {waiting ? t('x.reopen') : t('x.connect')}
        </button>
      )}
      {x.query.isError && <div className="xc__err small"><IconAlert size={14} />{t('x.statusError')}</div>}
    </div>
  );
}
