// Live data for the status bar and fee estimates.
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { publicActionsL2 } from 'viem/op-stack';
import { usePublicClient } from 'wagmi';
import { MAINNET_RPC, activeChain } from '../config';

export interface EthPrice { usd: number; krw: number | null; change24h: number | null }

async function fetchEthPrice(): Promise<EthPrice> {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,krw&include_24hr_change=true', {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return { usd: j.ethereum.usd, krw: j.ethereum.krw ?? null, change24h: j.ethereum.usd_24h_change ?? null };
  } catch {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return { usd: Number(j.lastPrice), krw: null, change24h: Number(j.priceChangePercent) };
  }
}

export const useEthPrice = () =>
  useQuery({ queryKey: ['eth-price'], queryFn: fetchEthPrice, refetchInterval: 30_000, staleTime: 25_000, retry: 2 });

const mainnetClient = createPublicClient({ chain: mainnet, transport: http(MAINNET_RPC) });

export function useGiwaLive() {
  const client = usePublicClient({ chainId: activeChain.id });
  return useQuery({
    queryKey: ['giwa-live'],
    queryFn: async () => {
      const [block, gasPrice] = await Promise.all([client!.getBlockNumber({ cacheTime: 0 }), client!.getGasPrice()]);
      return { block, gasPrice };
    },
    enabled: !!client,
    refetchInterval: 4_000,
    retry: 1,
  });
}

export const useMainnetGas = () =>
  useQuery({
    queryKey: ['mainnet-gas'],
    queryFn: () => mainnetClient.getGasPrice(),
    refetchInterval: 12_000,
    retry: 1,
  });

/** Total network fee on GIWA (L2 execution + L1 data fee). Undefined if the tx would fail. */
export function useNetworkFee(tx: { account?: Address; to?: Address; data?: Hex; value?: bigint } | null) {
  const client = usePublicClient({ chainId: activeChain.id });
  return useQuery({
    queryKey: ['network-fee', tx?.account, tx?.to, tx?.data, tx?.value?.toString()],
    queryFn: async () => {
      const l2 = client!.extend(publicActionsL2());
      return l2.estimateTotalFee({ account: tx!.account!, to: tx!.to!, data: tx!.data, value: tx!.value, chain: activeChain } as any);
    },
    enabled: !!client && !!tx?.account && !!tx?.to,
    staleTime: 15_000,
    retry: false,
  });
}

export function gweiText(wei?: bigint) {
  if (wei === undefined) return '—';
  const g = Number(wei) / 1e9;
  if (g === 0) return '0';
  if (g < 0.001) return g.toPrecision(2);
  return g < 10 ? g.toFixed(3) : g.toFixed(1);
}
