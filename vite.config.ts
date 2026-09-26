import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production builds must pin the contracts, chain and RPC the site will ever send wallets to. A build without them
 * fails here (fail closed) instead of silently trusting whatever the API says. Set ALLOW_UNPINNED=1 only for a
 * throwaway preview build.
 */
function requirePins(mode: string) {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (env.ALLOW_UNPINNED === '1') return;
  const addr = /^0x[0-9a-fA-F]{40}$/;
  const problems: string[] = [];
  if (!addr.test(String(env.VITE_MARKET_ADDRESS || '').trim())) problems.push('VITE_MARKET_ADDRESS (the marketplace contract)');
  const facs = String(env.VITE_FACTORY_ADDRESSES || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!facs.length || !facs.every((f) => addr.test(f))) problems.push('VITE_FACTORY_ADDRESSES (launchpad factories, comma separated)');
  if (!/^\d+$/.test(String(env.VITE_CHAIN_ID || ''))) problems.push('VITE_CHAIN_ID (91342 for GIWA Sepolia)');
  if (!/^https:\/\//.test(String(env.VITE_RPC_URL || ''))) problems.push('VITE_RPC_URL (https RPC, e.g. https://sepolia-rpc.giwa.io)');
  if (!/^https:\/\//.test(String(env.VITE_API_URL || ''))) problems.push('VITE_API_URL (your Railway API, https)');
  if (problems.length) {
    throw new Error(`\n\nSecurity settings missing for this production build. Add these in Netlify → Site configuration → Environment variables:\n  - ${problems.join('\n  - ')}\n`);
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') requirePins(mode);
  return {
    plugins: [react()],
    server: { port: 5173 },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            web3: ['wagmi', 'viem', '@tanstack/react-query'],
          },
        },
      },
    },
  };
});
