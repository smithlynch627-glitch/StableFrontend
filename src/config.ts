import { defineChain, type Chain } from 'viem';
import { chainConfig } from 'viem/op-stack';

const env = import.meta.env;

const CDN = 'https://res.cloudinary.com/t1gjf2kf/image/upload';

/** Brand shown across the site. */
export const BRAND = {
  name: 'STABLE',
  tagline: 'NFTs Launchpad & Marketplace',
  logo: `${CDN}/v1790232900/giwa_cow_logo.jpg`,
  websiteBanner: `${CDN}/v1790243972/Website_banenr.png`,
  xBanner: `${CDN}/v1790243997/X_banenr.png`,
};

/** GIWA COWS, the dedicated collection (its contract address comes from the backend config). */
export const GIWA_COWS = {
  name: 'GIWA COWS',
  slug: 'giwa-cows',
  supply: 2222,
  x: env.VITE_GIWA_COWS_X || '',
  logo: `${CDN}/v1790232900/giwa_cow_logo.jpg`,
  banner: `${CDN}/v1790232888/giwa_cows_2500x1500.jpg`,
  /** Official GIWA COWS artwork, used for previews and showcases. */
  images: [
    `${CDN}/v1790242033/1.png`,
    `${CDN}/v1790242035/2.png`,
    `${CDN}/v1790242033/3.png`,
    `${CDN}/v1790243758/4.jpg`,
    `${CDN}/v1790242034/5.png`,
    `${CDN}/v1790242036/6.png`,
    `${CDN}/v1790242033/7.png`,
    `${CDN}/v1790242036/8.png`,
    `${CDN}/v1790242036/9.png`,
    `${CDN}/v1790242037/10.png`,
    `${CDN}/v1790242037/11.png`,
    `${CDN}/v1790242038/12.png`,
    `${CDN}/v1790242039/13.png`,
    `${CDN}/v1790242039/14.png`,
    `${CDN}/v1790242040/15.png`,
    `${CDN}/v1790242039/16.png`,
    `${CDN}/v1790243753/17.jpg`,
    `${CDN}/v1790242040/18.png`,
  ],
};

export const API_URL = (env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

/**
 * Contract addresses pinned at build time (Netlify env). The website only ever asks a wallet to approve or sign
 * for THESE contracts, even if the API or database were tampered with and served other addresses.
 */
const addrList = (v?: string) => (v || '').split(',').map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a));
export const PINNED = {
  market: addrList(env.VITE_MARKET_ADDRESS)[0] || null,
  factories: addrList(env.VITE_FACTORY_ADDRESSES),
  /** The chain this site trades on. The server can't switch it (or hand wallets another RPC). */
  chainId: Number(env.VITE_CHAIN_ID || 0) || null,
};

export interface ChainInfo { chainId: number; name: string; rpcUrl: string; explorerUrl: string; isTestnet: boolean }

/** Builds the viem chain the whole app uses. The active network comes from the backend at startup. */
export function makeChain(n: ChainInfo): Chain {
  return defineChain({
    ...chainConfig, // OP Stack predeploys (gas price oracle for L1 fees) and tx formatters
    id: n.chainId,
    name: n.name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [env.VITE_RPC_URL || n.rpcUrl] } },
    blockExplorers: { default: { name: `${n.name} Explorer`, url: env.VITE_EXPLORER_URL || n.explorerUrl } },
    testnet: n.isTestnet,
  });
}

/** Live binding: set once in main.tsx before the app renders. */
export let activeChain: Chain = makeChain({
  chainId: Number(env.VITE_CHAIN_ID || 0) || 91342, name: 'GIWA Sepolia', rpcUrl: 'https://sepolia-rpc.giwa.io', explorerUrl: 'https://sepolia-explorer.giwa.io', isTestnet: true,
});
export function setActiveChain(c: Chain) {
  activeChain = c;
}

/** Ethereum mainnet RPC used only for the live gas reading in the status bar. */
export const MAINNET_RPC = env.VITE_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com';

export const LINKS = {
  docs: 'https://docs.giwa.io',
};
