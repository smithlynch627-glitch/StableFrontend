import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { SocialIcon } from '../components/Social';
import { IconAlert, IconCheck } from '../components/Icons';
import { X_CHANNEL, X_MESSAGE, X_STORAGE } from '../components/XConnect';

/** Where X sends the connect window back to. It tells the STABLE tab and closes itself. */
export default function XConnected() {
  const { t } = useI18n();
  const { search } = useLocation();
  const r = useMemo(() => {
    const p = new URLSearchParams(search);
    const status = ['ok', 'denied', 'expired', 'error'].includes(p.get('status') || '') ? (p.get('status') as string) : 'error';
    const user = /^[A-Za-z0-9_]{1,15}$/.test(p.get('user') || '') ? (p.get('user') as string) : null;
    const raw = p.get('next') || '';
    const next = /^\/[a-z0-9/_-]{0,80}$/i.test(raw) && !raw.includes('//') ? raw : '/create'; // same-site paths only
    return { status, user, next };
  }, [search]);
  const ok = r.status === 'ok' && !!r.user;

  useEffect(() => {
    const payload = { type: X_MESSAGE, status: r.status, user: r.user, at: Date.now() };
    try { window.opener?.postMessage(payload, window.location.origin); } catch {}
    try { const bc = new BroadcastChannel(X_CHANNEL); bc.postMessage(payload); bc.close(); } catch {}
    try { localStorage.setItem(X_STORAGE, JSON.stringify(payload)); } catch {}
    // Only a window opened by the Connect button can close itself; a full page stays and offers the way back.
    const id = window.setTimeout(() => { try { window.close(); } catch {} }, ok ? 900 : 2600);
    return () => window.clearTimeout(id);
  }, [r, ok]);

  const title = ok ? t('x.doneTitle', { user: `@${r.user}` }) : t(r.status === 'denied' ? 'x.denied' : r.status === 'expired' ? 'x.expired' : 'x.failed');
  return (
    <div className="page container xdone">
      <div className={`xdone__card${ok ? ' is-ok' : ''}`}>
        <span className="xdone__icon">{ok ? <IconCheck size={28} /> : <IconAlert size={28} />}</span>
        <span className="xdone__x"><SocialIcon kind="x" size={18} /></span>
        <h1 className="h2">{title}</h1>
        <p className="soft">{ok ? t('x.doneBody') : t('x.retryBody')}</p>
        <Link to={r.next} className="btn btn--lg">{t('x.back')}</Link>
      </div>
    </div>
  );
}
