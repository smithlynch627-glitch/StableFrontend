// Wallet sign-in: the user signs a one-time message (no gas) and gets a 7-day session token.
import { api } from './api';

const key = (a: string) => `giwa.session.${a.toLowerCase()}`;

function decodeExp(token: string): number {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
  } catch {
    return 0;
  }
}

export function getSession(address?: string | null): string | null {
  if (!address) return null;
  try {
    const token = localStorage.getItem(key(address));
    if (token && decodeExp(token) > Date.now() + 60_000) return token;
  } catch {}
  return null;
}

export async function ensureSession(address: string, signMessage: (message: string) => Promise<string>): Promise<string> {
  const existing = getSession(address);
  if (existing) return existing;
  const { message } = await api.post<{ message: string }>('/auth/nonce', { address });
  const signature = await signMessage(message);
  const { token } = await api.post<{ token: string }>('/auth/verify', { address, message, signature });
  try {
    localStorage.setItem(key(address), token);
  } catch {}
  return token;
}

export function clearSession(address?: string | null) {
  if (!address) return;
  try {
    localStorage.removeItem(key(address));
  } catch {}
}
