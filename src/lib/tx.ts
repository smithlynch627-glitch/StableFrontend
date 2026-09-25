// Hooks for signed-in API calls and one-off contract transactions (Studio + Admin).
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount, useSignMessage } from 'wagmi';
import { simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { activeChain } from '../config';
import { useI18n } from '../i18n';
import { useToast } from '../components/ui';
import { useWalletUI } from '../components/wallet';
import { api } from './api';
import { errorMessage } from './actions';
import { ensureSession } from './session';
import { wagmiConfig } from './wagmi';

export function useAuthedApi() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const token = useCallback(async () => {
    if (!address) throw new Error('Connect your wallet first');
    return ensureSession(address, (message) => signMessageAsync({ message }));
  }, [address, signMessageAsync]);
  return {
    token,
    get: async <T,>(path: string, params?: Record<string, any>) => api.get<T>(path, params, await token()),
    post: async <T,>(path: string, body?: unknown) => api.post<T>(path, body, await token()),
    put: async <T,>(path: string, body: unknown) => api.put<T>(path, body, await token()),
    patch: async <T,>(path: string, body: unknown) => api.patch<T>(path, body, await token()),
    del: async <T,>(path: string) => api.del<T>(path, await token()),
    upload: async <T,>(path: string, file: File, fields?: Record<string, string>) => api.upload<T>(path, file, await token(), fields),
  };
}

/** Simulate → send → wait → sync the indexer, with toasts. Returns the receipt or null. */
export function useTx() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const { address } = useAccount();
  const { ensureReady } = useWalletUI();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (label: string, params: any, success?: string) => {
      if (!(await ensureReady()) || !address) return null;
      setBusy(label);
      try {
        const { request } = await simulateContract(wagmiConfig, { ...params, account: address, chainId: activeChain.id });
        const hash = await writeContract(wagmiConfig, request as any);
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: activeChain.id });
        if (receipt.status !== 'success') throw new Error('The transaction failed on-chain.');
        await api.post('/orders/sync', { txHash: hash }).catch(() => undefined);
        toast(success || t('tx.done'));
        qc.invalidateQueries();
        return receipt;
      } catch (e) {
        toast(errorMessage(e, t), 'error');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [address, ensureReady, qc, t, toast],
  );
  return { busy, run };
}
