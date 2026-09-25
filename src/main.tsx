import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import App from './App';
import { I18nProvider } from './i18n';
import { AppConfigProvider } from './lib/appConfig';
import { initWagmi, wagmiConfig } from './lib/wagmi';
import { CurrencyProvider } from './lib/currency';
import { API_URL, makeChain, setActiveChain } from './config';
import type { AppConfig } from './lib/types';
import { ToastProvider } from './components/ui';
import { WalletProvider } from './components/wallet';
import { TradeProvider } from './components/trade';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } },
});

/** Load the active network from the backend first, so an admin network switch needs no rebuild. */
async function boot() {
  try {
    const res = await fetch(`${API_URL}/api/config`, { signal: AbortSignal.timeout(8000) });
    const cfg = (await res.json()) as AppConfig;
    if (cfg?.chainId) {
      const chain = makeChain({ chainId: cfg.chainId, name: cfg.network?.name || 'GIWA', rpcUrl: cfg.rpcUrl, explorerUrl: cfg.explorerUrl, isTestnet: cfg.network?.isTestnet ?? true });
      setActiveChain(chain);
      initWagmi(chain);
      queryClient.setQueryData(['config'], cfg);
    }
  } catch {
    // API unreachable: render with defaults; the header shows the problem.
  }
  render();
}

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AppConfigProvider>
            <CurrencyProvider>
            <ToastProvider>
              <BrowserRouter>
                <WalletProvider>
                  <TradeProvider>
                    <App />
                  </TradeProvider>
                </WalletProvider>
              </BrowserRouter>
            </ToastProvider>
            </CurrencyProvider>
          </AppConfigProvider>
        </I18nProvider>
      </QueryClientProvider>
    </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
}

boot();
