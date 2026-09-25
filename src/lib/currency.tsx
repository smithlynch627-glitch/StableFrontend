// ETH / USD display switch. Prices are always paid in ETH on-chain; this only changes how amounts are shown.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { formatEther } from 'viem';
import { eth } from './format';
import { useEthPrice } from './live';

export type Currency = 'ETH' | 'USD';
const KEY = 'stable.currency';

const Ctx = createContext<{ currency: Currency; setCurrency: (c: Currency) => void }>({ currency: 'ETH', setCurrency: () => {} });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, set] = useState<Currency>(() => {
    try {
      return localStorage.getItem(KEY) === 'USD' ? 'USD' : 'ETH';
    } catch {
      return 'ETH';
    }
  });
  const setCurrency = useCallback((c: Currency) => {
    set(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {}
  }, []);
  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCurrency = () => useContext(Ctx);

/** "$1,234", "$12.5K", "$3.1M", "<$0.01". */
export function usdText(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a === 0) return '$0';
  if (a < 0.01) return `${sign}<$0.01`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sign}${a.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: a >= 100 ? 0 : 2 })}`;
}

type Wei = string | bigint | null | undefined;
const ethNumber = (wei: Wei) => (wei === null || wei === undefined || wei === '' ? null : Number(formatEther(BigInt(wei))));

/**
 * money(wei)  → "0.05 ETH" or "$133.60" depending on the switch (falls back to ETH until the price loads).
 * usd(wei)    → always the USD value (or null), e.g. for a secondary line under an ETH price.
 */
export function useMoney() {
  const { currency } = useCurrency();
  const { data } = useEthPrice();
  const rate = data?.usd ?? null;
  return useMemo(() => {
    const usd = (wei: Wei) => {
      const n = ethNumber(wei);
      return n === null || !rate ? null : usdText(n * rate);
    };
    const money = (wei: Wei, unit = 'ETH') => {
      if (wei === null || wei === undefined || wei === '') return '—';
      if (currency === 'USD' && rate) return usd(wei)!;
      return `${eth(wei)} ${unit}`;
    };
    /** Signed amounts (PnL): "+0.4 ETH" / "-$120". */
    const signed = (wei: Wei, unit = 'ETH') => {
      if (wei === null || wei === undefined || wei === '') return '—';
      const b = BigInt(wei);
      const abs = b < 0n ? -b : b;
      const text = money(abs, unit);
      return b > 0n ? `+${text}` : b < 0n ? `-${text}` : text;
    };
    return { currency, rate, money, usd, signed, isUsd: currency === 'USD' && !!rate };
  }, [currency, rate]);
}

export function CurrencySwitch({ compact = false }: { compact?: boolean }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className={`segmented segmented--xs ${compact ? 'segmented--compact' : ''}`} role="group" aria-label="Currency">
      {(['ETH', 'USD'] as const).map((c) => (
        <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
