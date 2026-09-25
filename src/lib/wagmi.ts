import { createConfig, http } from 'wagmi';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import type { Chain } from 'viem';
import { activeChain } from '../config';

/**
 * Wallets:
 * - Every browser wallet that supports EIP-6963 (MetaMask, Rabby, Phantom, OKX, Coinbase / Base, Trust, Zerion, ...)
 *   is discovered automatically and listed by its own name and icon.
 * - `injected` covers older wallets that only expose window.ethereum.
 * - `coinbaseWallet` opens the Base / Coinbase Wallet app when its extension is not installed.
 * Auto-reconnect is off; WalletProvider reconnects only the wallet the user picked on this site.
 */
export function createWagmi(chain: Chain) {
  return createConfig({
    chains: [chain],
    connectors: [
      injected({ shimDisconnect: true }),
      coinbaseWallet({ appName: 'STABLE', version: '4', preference: { options: 'eoaOnly' } }),
    ],
    transports: { [chain.id]: http() },
    multiInjectedProviderDiscovery: true,
  });
}

export let wagmiConfig = createWagmi(activeChain);
export function initWagmi(chain: Chain) {
  wagmiConfig = createWagmi(chain);
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof createWagmi>;
  }
}
