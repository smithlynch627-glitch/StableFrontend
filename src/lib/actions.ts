// Every marketplace and launchpad transaction on GIWA.
// Safety: every write is simulated first (a failing tx is caught before the wallet opens, so no gas is wasted),
// payment amounts come from the contract or from the maker's signed order, and the contracts re-check everything.
import { parseEventLogs, zeroAddress, zeroHash, type Hash, type TransactionReceipt } from 'viem';
import { getBlock, readContract, signTypedData, simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { activeChain } from '../config';
import { api, ApiError } from './api';
import { ORDER_TYPES, collectionAbi, factoryAbi, marketAbi, wethAbi } from './abis';
import { ensureSession, getSession } from './session';
import type { Address, AppConfig, Collection, Order, SignedOrder } from './types';
import { wagmiConfig } from './wagmi';
import type { DictKey } from '../i18n/en';


export type StepKey =
  | 'signIn' | 'approveNft' | 'approveWeth' | 'wrap' | 'sign' | 'confirm' | 'wait'
  | 'save' | 'allowlist' | 'deploy' | 'publish' | 'cancelOld';

export const stepLabel: Record<StepKey, DictKey> = {
  signIn: 'step.signIn', approveNft: 'step.approveNft', approveWeth: 'step.approveWeth', wrap: 'step.wrap', sign: 'step.sign',
  confirm: 'step.confirm', wait: 'step.wait', save: 'step.save', allowlist: 'step.allowlist', deploy: 'step.deploy', publish: 'step.publish',
  cancelOld: 'step.cancelOld',
};

export interface ActionCtx {
  cfg: AppConfig;
  address: Address;
  signMessage: (message: string) => Promise<string>;
  progress: (key: StepKey) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function need(cfg: AppConfig): { market: Address; factory: Address; weth: Address } {
  if (!cfg.ready || !cfg.market || !cfg.factory) throw new Error('The marketplace contracts are not configured yet.');
  return { market: cfg.market as Address, factory: cfg.factory as Address, weth: cfg.weth as Address };
}

/** Simulate, then send, then wait. Throws with the contract's revert reason if it would fail. */
async function send(ctx: ActionCtx, params: any, step: StepKey = 'confirm'): Promise<TransactionReceipt> {
  const { request } = await simulateContract(wagmiConfig, { ...params, account: ctx.address, chainId: activeChain.id });
  ctx.progress(step);
  const hash = await writeContract(wagmiConfig, request as any);
  ctx.progress('wait');
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: activeChain.id });
  if (receipt.status !== 'success') throw new Error('The transaction failed on-chain.');
  return receipt;
}

async function sync(ctx: ActionCtx, txHash: Hash) {
  ctx.progress('save');
  await api.post('/orders/sync', { txHash }).catch(() => undefined);
}

async function session(ctx: ActionCtx) {
  const existing = getSession(ctx.address);
  if (existing) return existing;
  ctx.progress('signIn');
  return ensureSession(ctx.address, ctx.signMessage);
}

const read = <T>(p: any) => readContract(wagmiConfig, { ...p, chainId: activeChain.id }) as Promise<T>;

function randomSalt(): bigint {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return BigInt('0x' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''));
}

type OrderStruct = {
  maker: Address; side: number; collection: Address; tokenId: bigint; anyToken: boolean; price: bigint;
  maxFeeBps: number; maxRoyaltyBps: number; expiry: bigint; salt: bigint; counter: bigint;
};

const toStruct = (o: SignedOrder['order']): OrderStruct => ({
  maker: o.maker as Address, side: Number(o.side), collection: o.collection as Address, tokenId: BigInt(o.tokenId),
  anyToken: Boolean(o.anyToken), price: BigInt(o.price), maxFeeBps: Number(o.maxFeeBps), maxRoyaltyBps: Number(o.maxRoyaltyBps),
  expiry: BigInt(o.expiry), salt: BigInt(o.salt), counter: BigInt(o.counter),
});

const serialize = (o: OrderStruct) => ({
  ...o, tokenId: o.tokenId.toString(), price: o.price.toString(), expiry: o.expiry.toString(), salt: o.salt.toString(), counter: o.counter.toString(),
});

async function loadSigned(hash: string): Promise<SignedOrder> {
  const { order } = await api.get<{ order: Order }>(`/orders/${hash}`);
  if (!order.order_json?.signature) throw new Error('This order is missing its signature.');
  return order.order_json;
}

async function ensureNftApproval(ctx: ActionCtx, collection: Address, market: Address) {
  const approved = await read<boolean>({ address: collection, abi: collectionAbi, functionName: 'isApprovedForAll', args: [ctx.address, market] });
  if (!approved) {
    await send(ctx, { address: collection, abi: collectionAbi, functionName: 'setApprovalForAll', args: [market, true] }, 'approveNft');
  }
}

async function signOrder(ctx: ActionCtx, market: Address, o: OrderStruct) {
  ctx.progress('sign');
  const signature = await signTypedData(wagmiConfig, {
    account: ctx.address,
    domain: { name: 'STABLE Market', version: '1', chainId: activeChain.id, verifyingContract: market },
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: o,
  });
  ctx.progress('save');
  return api.post<{ hash: string }>('/orders', { order: serialize(o), signature });
}

const ERROR_KEYS: Record<string, DictKey> = {
  WrongPayment: 'err.WrongPayment', OrderUnavailable: 'err.OrderUnavailable', OrderExpired: 'err.OrderExpired', StaleCounter: 'err.OrderUnavailable',
  BadSignature: 'err.BadSignature', CollectionNotTradable: 'err.CollectionNotTradable', FeeChanged: 'err.FeeChanged', RoyaltyChanged: 'err.FeeChanged',
  SelfFill: 'err.SelfFill', NothingFilled: 'err.NothingFilled', ProceedsTooLow: 'err.FeeChanged', EnforcedPause: 'err.Paused',
  PhaseNotStarted: 'err.PhaseNotStarted', PhaseEnded: 'err.PhaseEnded', ExceedsMaxSupply: 'err.ExceedsMaxSupply',
  ExceedsWalletLimit: 'err.ExceedsWalletLimit', NotAllowlisted: 'err.NotAllowlisted', InvalidQuantity: 'err.InvalidQuantity',
  InvalidConfig: 'err.InvalidConfig', MintIsPaused: 'err.MintIsPaused', PublicPhaseRequired: 'err.PublicPhaseRequired',
  PhasesOutOfOrder: 'err.PhasesOutOfOrder', InvalidPhase: 'err.InvalidPhase', ERC721InsufficientApproval: 'err.NotApproved', ERC721IncorrectOwner: 'err.NotOwner',
};

export function errorMessage(e: unknown, t: (k: DictKey) => string): string {
  const err = e as any;
  if (e instanceof ApiError) return e.message;
  const walk = (fn: (x: any) => boolean) => (typeof err?.walk === 'function' ? err.walk(fn) : null);
  const reverted = walk((x) => x?.name === 'ContractFunctionRevertedError');
  const name = reverted?.data?.errorName;
  if (name && ERROR_KEYS[name]) return t(ERROR_KEYS[name]);
  const text = `${err?.shortMessage || ''} ${err?.details || ''} ${err?.message || ''}`;
  if (err?.code === 4001 || /user rejected|user denied|rejected the request|denied transaction|cancelled by user/i.test(text)) return t('common.rejected');
  if (walk((x) => x?.name === 'InsufficientFundsError') || /insufficient funds/i.test(text)) return t('err.InsufficientFunds');
  if (walk((x) => x?.name === 'ChainMismatchError') || /chain mismatch|does not match the target chain/i.test(text)) return t('err.WrongChain');
  if (name) return `${t('err.Reverted')} (${name})`;
  return (err?.shortMessage || err?.message || t('common.error')).split('\n')[0].slice(0, 200);
}

// ── Listings ────────────────────────────────────────────────────────────────
export async function listItem(ctx: ActionCtx, a: { collection: Collection; tokenId: string; priceWei: bigint; days: number }) {
  const { market } = need(ctx.cfg);
  const collection = a.collection.address as Address;
  await ensureNftApproval(ctx, collection, market);
  const [feeBps, counter, royalty] = await Promise.all([
    read<number>({ address: market, abi: marketAbi, functionName: 'marketFeeBps' }),
    read<bigint>({ address: market, abi: marketAbi, functionName: 'counters', args: [ctx.address] }),
    read<readonly [Address, bigint]>({ address: collection, abi: collectionAbi, functionName: 'royaltyInfo', args: [BigInt(a.tokenId), 10_000n] }).catch(() => [zeroAddress, 0n] as const),
  ]);
  return signOrder(ctx, market, {
    maker: ctx.address, side: 0, collection, tokenId: BigInt(a.tokenId), anyToken: false, price: a.priceWei,
    maxFeeBps: Number(feeBps), maxRoyaltyBps: Number(royalty[1]), expiry: BigInt(Math.floor(Date.now() / 1000) + a.days * 86400),
    salt: randomSalt(), counter,
  });
}

/**
 * Raise the price of an item you have listed. A signed listing stays valid until it is cancelled on-chain, so the
 * cheaper one is cancelled first (one transaction), then the new price is signed (free).
 */
export async function relistHigher(ctx: ActionCtx, a: { collection: Collection; tokenId: string; priceWei: bigint; days: number }) {
  const { market } = need(ctx.cfg);
  const { orders } = await api.get<{ orders: Order[] }>('/orders', { collection: a.collection.address, token: a.tokenId, maker: ctx.address.toLowerCase() });
  const open = orders.filter((o) => o.order_json?.signature);
  if (open.length) {
    const receipt = await send(ctx, { address: market, abi: marketAbi, functionName: 'cancel', args: [open.map((o) => toStruct(o.order_json!.order))] }, 'cancelOld');
    await sync(ctx, receipt.transactionHash);
  }
  return listItem(ctx, a);
}

export async function buyListings(ctx: ActionCtx, hashes: string[]) {
  const { market } = need(ctx.cfg);
  const signed = await Promise.all(hashes.map(loadSigned));
  const orders = signed.map((s) => toStruct(s.order));
  const total = orders.reduce((s, o) => s + o.price, 0n);
  const receipt =
    orders.length === 1
      ? await send(ctx, { address: market, abi: marketAbi, functionName: 'buy', args: [orders[0], signed[0].signature], value: orders[0].price })
      : await send(ctx, { address: market, abi: marketAbi, functionName: 'buyBatch', args: [orders, signed.map((s) => s.signature)], value: total });
  const fills = parseEventLogs({ abi: marketAbi, logs: receipt.logs, eventName: 'OrderFilled' });
  await sync(ctx, receipt.transactionHash);
  const spent = fills.reduce((s, f) => s + f.args.price, 0n);
  return { bought: fills.map((f) => ({ tokenId: f.args.tokenId.toString() })), skipped: orders.length - fills.length, spent };
}

export async function cancelOrder(ctx: ActionCtx, a: { order: Order }) {
  const { market } = need(ctx.cfg);
  const signed = await loadSigned(a.order.hash);
  const receipt = await send(ctx, { address: market, abi: marketAbi, functionName: 'cancel', args: [[toStruct(signed.order)]] });
  await sync(ctx, receipt.transactionHash);
}

// ── Offers ──────────────────────────────────────────────────────────────────
export async function wrapEth(ctx: ActionCtx, amountWei: bigint) {
  const { weth } = need(ctx.cfg);
  await send(ctx, { address: weth, abi: wethAbi, functionName: 'deposit', value: amountWei }, 'wrap');
  return true;
}

export async function makeOffer(
  ctx: ActionCtx,
  a: { collection: Collection; tokenId: string | null; priceWei: bigint; days: number; outstandingWei: bigint },
) {
  const { market, weth } = need(ctx.cfg);
  const collection = a.collection.address as Address;
  const [balance, allowance] = await Promise.all([
    read<bigint>({ address: weth, abi: wethAbi, functionName: 'balanceOf', args: [ctx.address] }),
    read<bigint>({ address: weth, abi: wethAbi, functionName: 'allowance', args: [ctx.address, market] }),
  ]);
  if (balance < a.priceWei) throw new Error('Not enough WETH. Wrap ETH first.');
  // Approve exactly what your open offers can spend, never an unlimited amount.
  const needed = a.outstandingWei + a.priceWei;
  if (allowance < needed) {
    await send(ctx, { address: weth, abi: wethAbi, functionName: 'approve', args: [market, needed] }, 'approveWeth');
  }
  const [feeBps, counter, royalty] = await Promise.all([
    read<number>({ address: market, abi: marketAbi, functionName: 'marketFeeBps' }),
    read<bigint>({ address: market, abi: marketAbi, functionName: 'counters', args: [ctx.address] }),
    read<readonly [Address, bigint]>({ address: collection, abi: collectionAbi, functionName: 'royaltyInfo', args: [BigInt(a.tokenId ?? 1), 10_000n] }).catch(() => [zeroAddress, 0n] as const),
  ]);
  return signOrder(ctx, market, {
    maker: ctx.address, side: 1, collection, tokenId: BigInt(a.tokenId ?? 0), anyToken: a.tokenId === null, price: a.priceWei,
    maxFeeBps: Number(feeBps), maxRoyaltyBps: Number(royalty[1]), expiry: BigInt(Math.floor(Date.now() / 1000) + a.days * 86400),
    salt: randomSalt(), counter,
  });
}

/** Payout breakdown straight from the contract, used for the seller's minimum. */
export async function quote(cfg: AppConfig, collection: string, tokenId: string, price: bigint) {
  const { market } = need(cfg);
  const [fee, , royalty, proceeds] = await read<readonly [bigint, Address, bigint, bigint]>({
    address: market, abi: marketAbi, functionName: 'quote', args: [collection as Address, BigInt(tokenId), price],
  });
  return { fee, royalty, proceeds };
}

export async function acceptOffer(ctx: ActionCtx, a: { order: Order; tokenId: string; minProceeds: bigint }) {
  const { market } = need(ctx.cfg);
  const signed = await loadSigned(a.order.hash);
  const o = toStruct(signed.order);
  await ensureNftApproval(ctx, o.collection, market);
  const receipt = await send(ctx, {
    address: market, abi: marketAbi, functionName: 'acceptOffer', args: [o, signed.signature, BigInt(a.tokenId), a.minProceeds],
  });
  await sync(ctx, receipt.transactionHash);
}

// ── Launchpad ───────────────────────────────────────────────────────────────
export async function mint(ctx: ActionCtx, a: { collection: string; phaseIndex: number; quantity: number; proof: `0x${string}`[] }) {
  const collection = a.collection as Address;
  // The price is read from the contract at the moment of minting, never from the API.
  const phases = await read<readonly { price: bigint; startTime: bigint }[]>({ address: collection, abi: collectionAbi, functionName: 'getPhases' });
  const phase = phases[a.phaseIndex];
  if (!phase) throw new Error('This mint phase does not exist.');
  // Right at the start of a phase, the latest block can still be a second older than the start time, which
  // would make the contract say "not started". Wait (max ~4 s) until the chain has reached the start.
  const start = Number(phase.startTime);
  if (Math.abs(Date.now() / 1000 - start) < 15) {
    for (let i = 0; i < 16; i++) {
      const b = await getBlock(wagmiConfig, { chainId: activeChain.id }).catch(() => null);
      if (!b || Number(b.timestamp) >= start) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const receipt = await send(ctx, {
    address: collection, abi: collectionAbi, functionName: 'mint',
    args: [BigInt(a.phaseIndex), BigInt(a.quantity), a.proof], value: phase.price * BigInt(a.quantity),
  });
  const transfers = parseEventLogs({ abi: collectionAbi, logs: receipt.logs, eventName: 'Transfer' })
    .filter((l) => l.address.toLowerCase() === collection.toLowerCase() && l.args.to.toLowerCase() === ctx.address.toLowerCase());
  await sync(ctx, receipt.transactionHash);
  return { tokenIds: transfers.map((l) => l.args.tokenId.toString()) };
}

export interface CreateForm {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  twitter: string;
  website: string;
  discord?: string;
  telegram?: string;
  maxSupply: number;
  baseUri: string;
  revealLater: boolean;
  unrevealedUri: string;
  royaltyBps: number;
  royaltyReceiver: string;
  payoutAddress: string;
  phases: { name: string; start: string; end: string; priceWei: bigint; maxPerWallet: number; useAllowlist: boolean; allowlist: string[] }[];
}

export async function createCollection(ctx: ActionCtx, f: CreateForm): Promise<Collection> {
  const { factory } = need(ctx.cfg);
  const token = await session(ctx);
  const roots: { id: string | null; root: `0x${string}` }[] = [];
  for (const p of f.phases) {
    if (p.useAllowlist && p.allowlist.length) {
      ctx.progress('allowlist');
      roots.push(await api.post<{ id: string; root: `0x${string}` }>('/drops/allowlists', { addresses: p.allowlist }, token));
    } else roots.push({ id: null, root: zeroHash });
  }
  const receipt = await send(
    ctx,
    {
      address: factory,
      abi: factoryAbi,
      functionName: 'createCollection',
      args: [
        {
          name: f.name,
          symbol: f.symbol,
          maxSupply: BigInt(f.maxSupply),
          baseURI: f.revealLater ? '' : f.baseUri,
          unrevealedURI: f.revealLater ? f.unrevealedUri : '',
          royaltyReceiver: (f.royaltyReceiver || ctx.address) as Address,
          royaltyBps: BigInt(f.royaltyBps),
          payoutAddress: (f.payoutAddress || ctx.address) as Address,
          phases: f.phases.map((p, i) => ({
            startTime: BigInt(Math.floor(new Date(p.start).getTime() / 1000)),
            endTime: BigInt(p.end ? Math.floor(new Date(p.end).getTime() / 1000) : 0),
            price: p.priceWei,
            maxPerWallet: p.maxPerWallet || 0,
            merkleRoot: roots[i].root,
          })),
        },
      ],
    },
    'deploy',
  );
  const [created] = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: 'CollectionCreated' });
  if (!created) throw new Error('Deployment finished but no collection was created.');
  await sync(ctx, receipt.transactionHash);
  ctx.progress('publish');
  const res = await api.post<{ collection: Collection }>(
    '/drops',
    {
      collection: created.args.collection,
      description: f.description,
      imageUrl: f.imageUrl,
      bannerUrl: f.bannerUrl,
      twitter: f.twitter || null,
      website: f.website || null,
      discord: f.discord || null,
      telegram: f.telegram || null,
      phases: f.phases.map((p, i) => ({ name: p.name, allowlistId: roots[i].id })),
    },
    token,
  );
  return res.collection;
}
