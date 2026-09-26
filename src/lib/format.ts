import { formatEther, parseEther } from 'viem';
import type { Lang } from '../i18n';

export function eth(wei: string | bigint | null | undefined, digits = 4): string {
  if (wei === null || wei === undefined || wei === '') return '—';
  const n = Number(formatEther(BigInt(wei)));
  if (n === 0) return '0';
  if (n < 0.000001) return '<0.000001';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
  // small prices keep `digits` significant figures: 0.00015, 0.0009625
  return Number(n.toPrecision(digits)).toLocaleString('en-US', { maximumFractionDigits: 10 });
}

export const toWei = (v: string) => {
  try {
    return parseEther((v || '0').trim() as `${number}`);
  } catch {
    return null;
  }
};

export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

export const num = (n: number | null | undefined, lang: Lang = 'en') =>
  n === null || n === undefined ? '—' : n.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US');

export function timeAgo(date: string | number | Date, lang: Lang): string {
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'ko' ? 'ko' : 'en', { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

/** Compact countdown like "2d 4h" / "3h 12m" / "45s". */
export function countdown(ms: number, lang: Lang): string {
  if (ms <= 0) return lang === 'ko' ? '0초' : '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const u = lang === 'ko' ? { d: '일', h: '시간', m: '분', s: '초' } : { d: 'd', h: 'h', m: 'm', s: 's' };
  if (d > 0) return `${d}${u.d} ${h}${u.h}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  if (m > 0) return `${m}${u.m} ${sec}${u.s}`;
  return `${sec}${u.s}`;
}

export const dateTime = (d: string | Date, lang: Lang) =>
  new Date(d).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const pct = (part: number, total: number) => (total > 0 ? Math.max(0.1, Math.round((part / total) * 1000) / 10) : 0);

export const bpsFee = (wei: bigint, bps: number) => (wei * BigInt(bps)) / 10000n;

/** Token id for display: long ids (name-service NFTs have 70+ digits) become "1157…9935". */
export function shortId(id: string | number | null | undefined): string {
  const s = String(id ?? '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/** Display name for an item: its metadata name, or "#id"; any long "#<id>" inside the name is shortened. */
export function tokenLabel(name: string | null | undefined, id: string | number | null | undefined): string {
  const sid = String(id ?? '');
  if (name && name.trim()) return sid.length > 12 ? name.replace(`#${sid}`, `#${shortId(sid)}`).trim() : name;
  return `#${shortId(sid)}`;
}

/**
 * Only https links (or a same-site path) are ever put into an <a href>. Anything else, such as javascript:,
 * data: or plain http links saved by a creator or served by a tampered API, is dropped.
 */
export function safeHref(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim();
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && !u.username && !u.password) return u.toString();
    if (import.meta.env.DEV && u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return u.toString();
  } catch {}
  return undefined;
}
