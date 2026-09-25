/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_MAINNET_RPC_URL?: string;
  readonly VITE_GIWA_COWS_X?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
