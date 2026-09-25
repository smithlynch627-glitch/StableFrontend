# Frontend: STABLE NFTs Launchpad & Marketplace

Vite + React 18 + TypeScript, wagmi + viem. Black-and-white GIWA theme, light/dark, English and Korean.
Everything runs on **GIWA Sepolia** against the deployed contracts.

## Run locally (PowerShell)

```powershell
cd frontend
npm install
Copy-Item .env.example .env   # VITE_API_URL=http://localhost:8080
npm run dev                   # http://localhost:5173
```

## Netlify

Base directory `frontend`, build command `npm run build`, publish directory `frontend/dist`.
Set `VITE_API_URL` to the Railway API URL. `netlify.toml` already has the SPA redirect.

## Wallets

- **Browser wallets** that support EIP-6963 are detected and listed with their own name and icon: MetaMask,
  Rabby, Phantom, OKX Wallet, Coinbase / Base Wallet and others. Older wallets that only expose
  `window.ethereum` still work.
- **Missing wallets:** Base (Coinbase Wallet) opens its app when the extension is missing. Wallets that are not
  installed show install links, and on phones they show "open in wallet app" links.
- **No silent connect:** the site never connects on its own. Users click Connect, pick a wallet, and approve it in
  the wallet. After a refresh only that same wallet is reconnected, and only if it still allows this site.
  Disconnect forgets it.
- **Wrong network:** the site offers a one-click switch to GIWA Sepolia and adds the network if the wallet doesn't know it.
- **Transactions:** every one is simulated before the wallet opens, so a transaction that would fail shows a
  clear reason instead of costing gas.
  - Mint amounts are read from the contract at the moment of minting.
  - The mint panel shows the estimated network fee (L2 + L1 data fee).
- **Phantom:** it only supports the EVM networks it lists. If it refuses to add GIWA Sepolia, users see the reason
  and can pick another wallet.

## Creators

- **Create page, three ways to add art:**
  1. A single pre-reveal image (launch now, reveal later)
  2. Upload an images folder and a metadata folder to IPFS. The site fills in the image links and names files `1.json`, `2.json`, ...
  3. Paste an existing `ipfs://CID/`
- **Phases:** each phase has its own price, time window, wallet limit and allowlist (paste addresses or upload a CSV/TXT).
- **Studio (`/studio/<collection>`, owner only):**
  - withdraw revenue; pause or resume minting; edit or add phases and replace allowlists
  - change the pre-reveal image; reveal via IPFS upload or CID; update the base URI; freeze metadata
  - airdrop / team reserve; royalty and payout address; reduce supply; contract URI; display details

## Pages

GIWA COWS (dedicated section with live mint), Home, Explore, Collection (filters, traits, sweep, offers,
activity), Item, Launchpad, Drop (mint), Create (5-step wizard), Studio, Profile (incl. created collections),
Activity, Support (tickets). The admin panel is a separate app (`../admin`) and is not part of this site.

The active network comes from the backend at startup, so switching to mainnet in the admin panel needs no rebuild.
`netlify.toml` sets a strict Content-Security-Policy and other security headers.
The bottom status bar shows live ETH price (USD, and KRW in Korean), GIWA block and gas, and Ethereum gas.

## Things you may change

| What | Where |
|---|---|
| Brand name / tagline | `BRAND` in `src/config.ts` |
| GIWA COWS art | `public/giwa-cows/pfp.png`, `public/giwa-cows/banner.png` |
| GIWA COWS X link | `VITE_GIWA_COWS_X` |
| Texts (EN / KO) | `src/i18n/en.ts`, `src/i18n/ko.ts` |
| Colors, radii, motion | tokens at the top of `src/styles.css` |
| Contract ABIs | `src/lib/abis.ts` (match `/contracts`) |

## Link previews (X, Telegram, WhatsApp, Discord)

`netlify/edge-functions/share-card.ts` adds each collection's title, stats and a generated 1200×630 card image
(from `/api/share/collection/<slug>.png`) to the HTML of `/collection`, `/launchpad` and `/item` pages.
It uses the same `VITE_API_URL` environment variable, so nothing extra is needed on Netlify.
