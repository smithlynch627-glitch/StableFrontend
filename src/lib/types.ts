export type Address = `0x${string}`;

export interface AppConfig {
  ready: boolean;
  network?: { key: string; name: string; isTestnet: boolean };
  ipfsUploads?: boolean;
  /** Preferred IPFS gateway (e.g. the owner's Pinata dedicated gateway), ending in /ipfs/ */
  ipfsGateway?: string | null;
  socials?: { x: string | null; discord: string | null; telegram: string | null; website: string | null };
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  market: string | null;
  factory: string | null;
  feeVault: string | null;
  weth: string;
  marketFeeBps: number | null;
  mintFeeBps: number | null;
  official: { address: string | null; slug: string };
}

export interface Collection {
  address: string;
  slug: string;
  name: string;
  symbol: string | null;
  description: string | null;
  image_url: string | null;
  banner_url: string | null;
  art_style: 'cow' | 'tile';
  creator: string | null;
  royalty_bps: number;
  royalty_receiver: string | null;
  max_supply: number | null;
  total_supply: number;
  verified: boolean;
  is_official: boolean;
  is_external?: boolean;
  featured?: boolean;
  hidden?: boolean;
  tradable?: boolean;
  revealed?: boolean | null;
  metadata_frozen?: boolean;
  mint_paused?: boolean;
  contract_uri?: string | null;
  twitter: string | null;
  website: string | null;
  discord?: string | null;
  telegram?: string | null;
  drop_hidden?: boolean;
  about?: string | null;
  about_image_url?: string | null;
  about_items?: { label: string; value: string }[];
  floor_wei: string | null;
  best_offer_wei: string | null;
  volume_wei: string;
  volume_24h_wei: string;
  sales_count: number;
  owners_count: number;
  listed_count: number;
  created_at: string;
}

export interface Attribute {
  trait_type: string;
  value: string;
  count?: number;
}

export interface Token {
  collection: string;
  token_id: string;
  owner: string;
  name: string | null;
  image_url: string | null;
  attributes: Attribute[];
  rarity_rank: number | null;
  last_sale_wei: string | null;
  listing_hash: string | null;
  listing_price_wei: string | null;
  listing_end_time: string | null;
  listing_maker: string | null;
  collection_name?: string;
  collection_slug?: string;
  art_style?: 'cow' | 'tile';
  tradable?: boolean;
  is_official?: boolean;
}

export interface Order {
  hash: string;
  kind: 'listing' | 'offer' | 'collection_offer';
  collection?: string;
  token_id: string | null;
  maker: string;
  price_wei: string;
  currency: string;
  end_time: string;
  created_at?: string;
  collection_name?: string;
  collection_slug?: string;
  art_style?: 'cow' | 'tile';
  token_name?: string | null;
  token_image?: string | null;
  token_attributes?: Attribute[] | null;
  order_json?: SignedOrder;
}

export interface Activity {
  id: number;
  type: string;
  collection: string;
  token_id: string | null;
  from_addr: string | null;
  to_addr: string | null;
  price_wei: string | null;
  tx_hash: string | null;
  created_at: string;
  collection_name: string;
  collection_slug: string;
  art_style: 'cow' | 'tile';
  collection_image: string | null;
  token_name: string | null;
  token_image: string | null;
  token_attributes: Attribute[] | null;
}

export interface Phase {
  id?: number | null;
  name: string;
  start: string;
  end: string | null;
  priceWei: string;
  maxPerWallet: number | null;
  hasAllowlist: boolean;
  index: number;
  status: 'upcoming' | 'live' | 'ended';
}

export interface DropState {
  phases: Phase[];
  status: 'live' | 'upcoming' | 'ended' | 'sold_out';
  livePhase: Phase | null;
  nextPhase: Phase | null;
  platformFeeBps: number;
  featured?: boolean;
  changes?: PhaseChangeEntry[];
}

export interface DropListItem extends DropState {
  collection: Collection;
}

export interface Eligibility {
  index: number;
  eligible: boolean;
  proof: `0x${string}`[];
  hasAllowlist: boolean;
}

export interface SignedOrder {
  order: {
    maker: string; side: number; collection: string; tokenId: string; anyToken: boolean; price: string;
    maxFeeBps: number; maxRoyaltyBps: number; expiry: string; salt: string; counter: string;
  };
  signature: `0x${string}`;
}

export interface TraitGroup {
  trait_type: string;
  values: { value: string; count: number }[];
}

export interface UserProfile {
  user: { address: string; username: string | null; bio: string };
  counts: { owned: number; listed: number; offers_made: number };
  collections?: Collection[];
}

export interface HolderSample { token_id: string; name: string | null; image_url: string | null }
export interface Holder {
  owner: string; username: string | null; rank: number; share: number;
  held: number; minted: number; bought: number; sold: number;
  spent: string; received: string; volume: string; pnl: string;
  samples: HolderSample[];
}
export interface HoldersResponse {
  holders: Holder[];
  total: number;
  floorWei: string | null;
  summary: { holders: number; supply: number; uniquePct: number; avgHeld: number; top10Pct: number; distribution: { label: string; count: number }[] };
}

export interface PhaseChange {
  type: 'added' | 'removed' | 'changed' | 'paused' | 'resumed' | 'supply';
  phase?: string;
  field?: 'name' | 'price' | 'start' | 'end' | 'maxPerWallet' | 'allowlist';
  from?: string | number | null;
  to?: string | number | null;
  after?: { start: string; end: string | null; priceWei: string; maxPerWallet: number | null; allowlist: boolean };
  before?: { start: string; end: string | null; priceWei: string; maxPerWallet: number | null; allowlist: boolean };
}
export interface PhaseChangeEntry { id: number; tx_hash: string | null; changes: PhaseChange[]; changed_at: string }

export type AnalyticsRange = '24h' | '7d' | '30d' | 'all';
export interface AnalyticsSale { token_id: string; price_wei: string; created_at: string; from_addr: string; to_addr: string; tx_hash: string; name: string | null; image_url: string | null; rarity_rank: number | null }
export interface Analytics {
  range: AnalyticsRange;
  totals: { sales: number; volume: string; avg: string | null; min: string | null; max: string | null; buyers: number; sellers: number; floor: string | null; bestOffer: string | null; owners: number; listed: number; supply: number };
  previous: { sales: number; volume: string } | null;
  series: { t: string; sales: number; volume: string; avg: string; min: string; max: string }[];
  sales: { t: string; price: string; token_id: string }[];
  floor: { t: string; floor: string | null; listed: number; owners: number }[];
  topSales: AnalyticsSale[];
  rareListed: { token_id: string; name: string | null; image_url: string | null; rarity_rank: number; price_wei: string; maker: string }[];
  mint: { minted: number; minters: number; revenue: string };
}
