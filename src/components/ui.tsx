import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { countdown, eth as formatEthLocal } from '../lib/format';
import { IconAlert, IconCheck, IconClose, IconCopy, IconVerified } from './Icons';

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, title, children, footer, width = 480, locked = false,
}: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; locked?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !locked && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input, button:not([data-close]), select, textarea')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, locked, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={() => !locked && onClose()} />
      <div className="modal" ref={ref} style={{ ['--w' as any]: `${width}px` }}>
        <div className="modal__head">
          <div className="h3">{title}</div>
          <button className="icon-btn" data-close onClick={onClose} disabled={locked} aria-label={t('common.close')}>
            <IconClose size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Toasts ────────────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; kind: 'success' | 'error'; leaving?: boolean };
const ToastCtx = createContext<(message: string, kind?: 'success' | 'error') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 260);
  }, []);
  const push = useCallback(
    (message: string, kind: 'success' | 'error' = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts.slice(-3), { id, message, kind }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6500 : 4000);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind === 'error' ? 'toast--error' : ''} ${t.leaving ? 'is-leaving' : ''}`}>
              {t.kind === 'error' ? <IconAlert size={18} /> : <IconCheck size={18} />}
              <span>{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><IconClose size={14} /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ── Time ──────────────────────────────────────────────────────────────────────
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Countdown({ to }: { to: string | number }) {
  const { lang } = useI18n();
  const now = useNow(1000);
  return <span className="mono-num">{countdown(new Date(to).getTime() - now, lang)}</span>;
}

// ── Small pieces ──────────────────────────────────────────────────────────────
export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number | string; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="nft-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="nft-card" style={{ cursor: 'default' }}>
          <div className="nft-card__media"><div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} /></div>
          <div className="nft-card__body"><Skeleton h={14} w="60%" /><Skeleton h={16} w="40%" /></div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <div>{title}</div>
      {action}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // On narrow screens the tab row scrolls sideways: keep the selected tab in view (without moving the page).
  useEffect(() => {
    const row = ref.current;
    const btn = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !btn || row.scrollWidth <= row.clientWidth) return;
    const left = btn.offsetLeft - (row.clientWidth - btn.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [value]);
  return (
    <div className="tabs" role="tablist" ref={ref}>
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)}>
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  );
}

export function Badge({ official, verified, size = 16 }: { official?: boolean; verified?: boolean; size?: number }) {
  const { t } = useI18n();
  if (!official && !verified) return null;
  return (
    <span title={official ? t('common.official') : t('common.verified')} style={{ display: 'inline-flex' }}>
      <IconVerified size={size} official={official} />
    </span>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn--ghost btn--sm"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      aria-label={t('common.copy')}
    >
      {done ? <IconCheck size={15} /> : <IconCopy size={15} />}
      {label && <span>{done ? t('common.copied') : label}</span>}
    </button>
  );
}

export function Eth({ wei, suffix = 'ETH', className }: { wei: string | bigint | null | undefined; suffix?: string; className?: string }) {
  return <span className={`mono-num ${className ?? ''}`}>{wei === null || wei === undefined ? '—' : `${formatEthLocal(wei)} ${suffix}`}</span>;
}


/** Renders a translated sentence with a live countdown in place of {time}. */
export function CountdownLabel({ k, to }: { k: 'lp.endsIn' | 'lp.startsIn' | 'item.endsIn'; to: string | number }) {
  const { t } = useI18n();
  const [before, after = ''] = t(k, { time: '\u0000' }).split('\u0000');
  return (
    <span>
      {before}
      <Countdown to={to} />
      {after}
    </span>
  );
}
