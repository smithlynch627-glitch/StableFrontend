import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount, useAccountEffect, useConfig, useConnect, useSwitchChain } from 'wagmi';
import { reconnect, watchConnectors } from 'wagmi/actions';
import { activeChain } from '../config';
import { useI18n } from '../i18n';
import { errorMessage } from '../lib/actions';
import { IconExternal, IconWallet } from './Icons';
import { Modal, useToast } from './ui';

const LAST_WALLET = 'stable.wallet';

interface WalletUI {
  openConnect: () => void;
  /** True when a wallet is connected on GIWA; otherwise opens the picker or asks to switch network. */
  ensureReady: () => Promise<boolean>;
  forget: () => void;
}

const Ctx = createContext<WalletUI>({ openConnect: () => {}, ensureReady: async () => false, forget: () => {} });
export const useWalletUI = () => useContext(Ctx);

/** Popular wallets we suggest when they are not installed (matched by their EIP-6963 id). */
const SUGGESTED = [
  { rdns: 'io.metamask', name: 'MetaMask', url: 'https://metamask.io/download/', mobile: (u: string) => `https://metamask.app.link/dapp/${u.replace(/^https?:\/\//, '')}` },
  { rdns: 'io.rabby', name: 'Rabby', url: 'https://rabby.io/', mobile: null },
  { rdns: 'app.phantom', name: 'Phantom', url: 'https://phantom.com/download', mobile: (u: string) => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(new URL(u).origin)}` },
  { rdns: 'com.okex.wallet', name: 'OKX Wallet', url: 'https://web3.okx.com/download', mobile: (u: string) => `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(u)}` },
  { rdns: 'com.coinbase.wallet', name: 'Base (Coinbase Wallet)', url: 'https://www.coinbase.com/wallet/downloads', mobile: (u: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u)}` },
];

const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function WalletProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const [open, setOpen] = useState(false);
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const toast = useToast();
  const { t } = useI18n();

  // Reconnect only the wallet the user picked on this site before (never any other wallet).
  const tried = useRef(false);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LAST_WALLET);
    } catch {}
    if (!saved) return;
    const attempt = (list: readonly { id: string }[]) => {
      if (tried.current) return;
      const c = config.connectors.find((x) => x.id === saved);
      if (!c) return;
      tried.current = true;
      reconnect(config, { connectors: [c] }).catch(() => undefined);
    };
    attempt(config.connectors);
    const unwatch = watchConnectors(config, { onChange: attempt });
    const stop = setTimeout(() => (tried.current = true), 4000);
    return () => {
      unwatch();
      clearTimeout(stop);
    };
  }, [config]);

  useAccountEffect({
    onConnect: ({ connector }) => {
      try {
        localStorage.setItem(LAST_WALLET, connector.id);
      } catch {}
    },
  });

  const forget = useCallback(() => {
    try {
      localStorage.removeItem(LAST_WALLET);
    } catch {}
  }, []);

  const ensureReady = useCallback(async () => {
    if (!isConnected) {
      setOpen(true);
      return false;
    }
    if (chainId !== activeChain.id) {
      try {
        await switchChainAsync({ chainId: activeChain.id });
        return true;
      } catch (e) {
        toast(`${t('wallet.switchFailed')} ${errorMessage(e, t)}`, 'error');
        return false;
      }
    }
    return true;
  }, [isConnected, chainId, switchChainAsync, toast, t]);

  const value = useMemo(() => ({ openConnect: () => setOpen(true), ensureReady, forget }), [ensureReady, forget]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ConnectModal open={open} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}

function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { connectors, connectAsync } = useConnect();
  const [pending, setPending] = useState<string | null>(null);

  const { detected, missing } = useMemo(() => {
    const discovered = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected');
    const ids = new Set(discovered.map((c) => c.id));
    const legacy = connectors.find((c) => c.id === 'injected');
    const hasLegacy = typeof window !== 'undefined' && Boolean((window as any).ethereum);
    const coinbase = connectors.find((c) => c.id === 'coinbaseWalletSDK');
    const list = [...discovered];
    if (!discovered.length && hasLegacy && legacy) list.push(legacy);
    if (coinbase && !ids.has('com.coinbase.wallet')) list.push(coinbase);
    return { detected: list, missing: SUGGESTED.filter((s) => !ids.has(s.rdns) && !(s.rdns === 'com.coinbase.wallet' && coinbase)) };
  }, [connectors]);

  async function connect(c: (typeof connectors)[number]) {
    setPending(c.uid);
    try {
      await connectAsync({ connector: c, chainId: activeChain.id });
      onClose();
    } catch (e) {
      toast(errorMessage(e, t), 'error');
    } finally {
      setPending(null);
    }
  }

  const label = (c: (typeof connectors)[number]) =>
    c.id === 'coinbaseWalletSDK' ? 'Base (Coinbase Wallet)' : c.id === 'injected' ? t('wallet.browser') : c.name;
  const here = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <Modal open={open} onClose={onClose} title={t('wallet.title')} width={440}>
      <p className="soft">{t('wallet.body', { chain: activeChain.name })}</p>
      <div className="wallet-list">
        {detected.map((c) => (
          <button key={c.uid} className="wallet-option" onClick={() => connect(c)} disabled={!!pending}>
            {c.icon ? <img src={c.icon} alt="" width={36} height={36} /> : <span className="wallet-option__icon"><IconWallet /></span>}
            <span className="wallet-option__name">{label(c)}</span>
            {pending === c.uid ? (
              <span className="small muted row" style={{ gap: 6 }}><span className="spinner" />{t('wallet.connecting')}</span>
            ) : c.id !== 'coinbaseWalletSDK' ? (
              <span className="pill">{t('wallet.detected')}</span>
            ) : null}
          </button>
        ))}
      </div>
      {missing.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="small strong">{isMobile() ? t('wallet.openIn') : t('wallet.getWallet')}</span>
          <div className="wallet-list">
            {missing.map((w) => {
              const href = isMobile() && w.mobile ? w.mobile(here) : w.url;
              return (
                <a key={w.rdns} className="wallet-option wallet-option--ghost" href={href} target="_blank" rel="noreferrer">
                  <span className="wallet-option__icon"><IconWallet /></span>
                  <span className="wallet-option__name">{w.name}</span>
                  <IconExternal size={15} />
                </a>
              );
            })}
          </div>
        </div>
      )}
      <p className="tiny muted">{t('wallet.privacy')}</p>
    </Modal>
  );
}
