// Community links (X, Discord, Telegram). Brand icons are loaded from the Simple Icons CDN
// (the official brand marks as published there), shown white-on-black / black-on-white per theme.
import type { ReactNode } from 'react';
import { safeHref } from '../lib/format';

const ICON = (slug: string) => `https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${slug}.svg`;
export type SocialKind = 'x' | 'discord' | 'telegram' | 'website';
const LABEL: Record<SocialKind, string> = { x: 'X', discord: 'Discord', telegram: 'Telegram', website: 'Website' };

export function SocialIcon({ kind, size = 18 }: { kind: SocialKind; size?: number }) {
  if (kind === 'website') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }
  if (kind === 'x') {
    // The X mark inline, so it takes the text colour everywhere (buttons, dark panels, both themes).
    return (
      <svg className="social-svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
      </svg>
    );
  }
  return <img className="social-icon" src={ICON(kind)} alt="" width={size} height={size} loading="lazy" />;
}

export function SocialLink({ kind, href, size = 18, children }: { kind: SocialKind; href: string; size?: number; children?: ReactNode }) {
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <a className="social-btn" href={safe} target="_blank" rel="noreferrer noopener" aria-label={LABEL[kind]} title={LABEL[kind]}>
      <SocialIcon kind={kind} size={size} />
      {children}
    </a>
  );
}
