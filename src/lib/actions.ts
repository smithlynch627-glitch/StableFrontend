// Every marketplace and launchpad transaction on GIWA.
// Safety: every write is simulated first (a failing tx is caught before the wallet opens, so no gas is wasted),
// payment amounts come from the contract or from the maker's signed order, and the contracts re-check everything.
import { hashTypedData, isAddress, parseEventLogs, zeroAddress, zeroHash, type Hash, type TransactionReceipt } from 'viem';
import { getBlock, readContract, signTypedData, simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { PINNED, activeChain } from '../config';
import { api, ApiError } from './api';
import { BULK_MAGIC, ORDER_TYPES, collectionAbi, factoryAbi, marketAbi, wethAbi } from './abis';
import { ensureSession, getSession } from './session';
import type { Address, AppConfig, Collection, Order, SignedOrder } from './types';
import { wagmiConfig } from './wagmi';
import type { DictKey } from '../i18n/en';


export type StepKey =
  | 'signIn' | 'approveNft' | 'approveWeth' | 'wrap' | 'sign' | 'confirm' | 'wait'
  | 'save' | 'allowlist' | 'deploy' | 'publish' | 'cancelOld' | 'transfer' | 'revoke';

export const stepLabel: Record<StepKey, DictKey> = {
  signIn: 'step.signIn', approveNft: 'step.approveNft', approveWeth: 'step.approveWeth', wrap: 'step.wrap', sign: 'step.sign',
  confirm: 'step.confirm', wait: 'step.wait', save: 'step.save', allowlist: 'step.allowlist', deploy: 'step.deploy', publish: 'step.publish',
  cancelOld: 'step.cancelOld', transfer: 'step.transfer', revoke: 'step.revoke',
};

export interface ActionCtx {
  cfg: AppConfig;
  address: Address;
  signMessage: (message: string) => Promise<string>;
  progress: (key: StepKey) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
/** OP Stack WETH (the same address on every OP chain, GIWA included). */
const WETH = (import.meta.env.VITE_WETH_ADDRESS || '0x4200000000000000000000000000000000000006').toLowerCase();
const UNPINNED = 'This website build is missing its security settings (VITE_MARKET_ADDRESS, VITE_FACTORY_ADDRESSES, VITE_CHAIN_ID). Trading is disabled until they are set.';
const TAMPERED = 'Security check failed: the marketplace contract address from the server does not match the one built into this website. Nothing was sent. Please contact the STABLE team.';

/**
 * Contract addresses for a wallet action. They must match the addresses pinned into the website at build time,
 * so a compromised API or database can never make a wallet approve, sign for or pay an attacker's contract.
 */
function need(cfg: AppConfig): { market: Address; factory: Address; weth: Address } {
  if (!cfg.ready || !cfg.market || !cfg.factory) throw new Error('The marketplace contracts are not configured yet.');
  // A production build without pinned addresses refuses to trade (fail closed), instead of trusting the server.
  if (import.meta.env.PROD && (!PINNED.market || !PINNED.factories.length || !PINNED.chainId)) throw new Error(UNPINNED);
  if (PINNED.chainId && (activeChain.id !== PINNED.chainId || cfg.chainId !== PINNED.chainId)) throw new Error(TAMPERED);
  const market = cfg.market.toLowerCase();
  const factory = cfg.factory.toLowerCase();
  if (PINNED.market && market !== PINNED.market) throw new Error(TAMPERED);
  if (PINNED.factories.length && !PINNED.factories.includes(factory)) throw new Error(TAMPERED);
  if (cfg.weth.toLowerCase() !== WETH) throw new Error(TAMPERED);
  return { market: market as Address, factory: factory as Address, weth: WETH as Address };
}

/** Before paying a mint: the collection must have been created by a STABLE launchpad factory. */
async function assertLaunchpadCollection(cfg: AppConfig, collection: Address) {
  const factories = PINNED.factories.length ? PINNED.factories : cfg.factory ? [cfg.factory.toLowerCase()] : [];
  for (const f of factories) {
    const ok = await read<boolean>({ address: f as Address, abi: factoryAbi, functionName: 'isCollection', args: [collection] }).catch(() => false);
    if (ok) return;
  }
  throw new Error('Security check failed: this contract was not created by the STABLE launchpad. Nothing was sent.');
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

const eip712Domain = (market: Address) => ({ name: 'STABLE Market', version: '1', chainId: activeChain.id, verifyingContract: market });
const orderHashOf = (market: Address, o: OrderStruct) =>
  hashTypedData({ domain: eip712Domain(market), types: ORDER_TYPES, primaryType: 'Order', message: o }).toLowerCase();
const ORDER_MISMATCH = 'Security check failed: the order from the server does not match the item shown. Nothing was sent.';
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The NFT must really be yours (checked on-chain), before any approval or signature. */
async function assertOwner(ctx: ActionCtx, collection: Address, tokenId: string | bigint) {
  const owner = await read<Address>({ address: collection, abi: collectionAbi, functionName: 'ownerOf', args: [BigInt(tokenId)] }).catch(() => null);
  if (!owner || owner.toLowerCase() !== ctx.address.toLowerCase()) throw new Error('You no longer own this item.');
}

async function loadSigned(hash: string): Promise<SignedOrder> {
  const { order } = await api.get<{ order: Order }>(`/orders/${hash}`);
  if (!order.order_json?.signature) throw new Error('This order is missing its signature.');
  return order.order_json;
}

async function ensureNftApproval(ctx: ActionCtx, collection: Address, market: Address) {
  // Only ever approve the pinned marketplace, and only for collections it can trade (checked on-chain).
  const tradable = await read<boolean>({ address: market, abi: marketAbi, functionName: 'isTradable', args: [collection] });
  if (!tradable) throw new Error('This collection cannot be traded on STABLE. Nothing was sent.');
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
  await assertOwner(ctx, collection, a.tokenId);
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
  const open = orders.filter((o) => {
    const x = o.order_json?.order;
    return !!o.order_json?.signature && !!x && same(x.maker, ctx.address) && Number(x.side) === 0 && same(x.collection, a.collection.address) && String(x.tokenId) === String(a.tokenId);
  });
  if (open.length) {
    const receipt = await send(ctx, { address: market, abi: marketAbi, functionName: 'cancel', args: [open.map((o) => toStruct(o.order_json!.order))] }, 'cancelOld');
    await sync(ctx, receipt.transactionHash);
  }
  return listItem(ctx, a);
}

export type BuyItem = { hash: string; collection: string; tokenId: string; priceWei: bigint };

/**
 * Buy one or more listings. Each signed order is checked against the item shown on screen (its id, collection,
 * token and price) before the wallet opens, so a tampered server can't swap in another item or a higher price.
 */
export async function buyListings(ctx: ActionCtx, items: BuyItem[]) {
  const { market } = need(ctx.cfg);
  const signed = await Promise.all(items.map((i) => loadSigned(i.hash)));
  const orders = signed.map((s) => toStruct(s.order));
  const now = BigInt(Math.floor(Date.now() / 1000));
  orders.forEach((o, i) => {
    const want = items[i];
    const ok = orderHashOf(market, o) === want.hash.toLowerCase() && o.side === 0 && !o.anyToken && same(o.collection, want.collection)
      && o.tokenId === BigInt(want.tokenId) && o.price > 0n && o.price <= want.priceWei && o.expiry > now && !same(o.maker, ctx.address);
    if (!ok) throw new Error(ORDER_MISMATCH);
  });
  const total = orders.reduce((s, o) => s + o.price, 0n);
  const shown = items.reduce((s, i) => s + i.priceWei, 0n);
  if (total > shown) throw new Error(ORDER_MISMATCH);
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

// ── Bulk: list, delist and send many items ──────────────────────────────────
export type BulkListItem = { collection: Collection; tokenId: string; priceWei: bigint };
const itemKey = (collection: string, tokenId: string) => `${collection.toLowerCase()}:${tokenId}`;

async function myActiveListings(maker: Address, items: { collection: string; tokenId: string }[]) {
  const { orders } = await api.get<{ orders: Order[] }>('/orders/active', {
    maker: maker.toLowerCase(), items: items.map((i) => itemKey(i.collection, i.tokenId)).join(','),
  });
  // Only your own listings, on exactly the items you picked (never trust the server's list blindly).
  const wanted = new Set(items.map((i) => itemKey(i.collection, i.tokenId)));
  return orders.filter((o) => {
    const x = o.order_json?.order;
    return !!o.order_json?.signature && !!x && same(x.maker, maker) && Number(x.side) === 0 && !x.anyToken && wanted.has(itemKey(x.collection, String(x.tokenId)));
  });
}

/**
 * List up to 50 items with ONE signature. Steps: approve each collection once (only if needed) → cancel any cheaper
 * listing of yours on these items in one transaction (only when raising a price) → sign all listings at once.
 * The wallet shows every item and price in the signature request.
 */
export async function bulkList(ctx: ActionCtx, a: { items: BulkListItem[]; days: number }) {
  const { market } = need(ctx.cfg);
  if (!a.items.length || a.items.length > 50) throw new Error('Choose 1 to 50 items.');
  if (a.items.some((i) => i.priceWei <= 0n)) throw new Error('Every item needs a price.');
  const cols = [...new Map(a.items.map((i) => [i.collection.address.toLowerCase(), i.collection])).values()];
  for (const c of cols) await ensureNftApproval(ctx, c.address as Address, market);

  const priceOf = new Map(a.items.map((i) => [itemKey(i.collection.address, i.tokenId), i.priceWei]));
  for (const i of a.items) await assertOwner(ctx, i.collection.address as Address, i.tokenId);
  const cheaper = (await myActiveListings(ctx.address, a.items.map((i) => ({ collection: i.collection.address, tokenId: i.tokenId }))))
    .filter((o) => BigInt(o.order_json!.order.price) < (priceOf.get(itemKey(o.order_json!.order.collection, String(o.order_json!.order.tokenId))) ?? 0n));
  if (cheaper.length) {
    const receipt = await send(ctx, { address: market, abi: marketAbi, functionName: 'cancel', args: [cheaper.map((o) => toStruct(o.order_json!.order))] }, 'cancelOld');
    await sync(ctx, receipt.transactionHash);
  }

  const [feeBps, counter, ...royalties] = await Promise.all([
    read<number>({ address: market, abi: marketAbi, functionName: 'marketFeeBps' }),
    read<bigint>({ address: market, abi: marketAbi, functionName: 'counters', args: [ctx.address] }),
    ...cols.map((c) => read<readonly [Address, bigint]>({ address: c.address as Address, abi: collectionAbi, functionName: 'royaltyInfo', args: [BigInt(a.items.find((i) => i.collection === c || i.collection.address.toLowerCase() === c.address.toLowerCase())!.tokenId), 10_000n] }).catch(() => [zeroAddress, 0n] as const)),
  ]);
  const royaltyOf = new Map(cols.map((c, i) => [c.address.toLowerCase(), Number((royalties[i] as readonly [Address, bigint])[1])]));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + a.days * 86400);
  const orders: OrderStruct[] = a.items.map((i) => ({
    maker: ctx.address, side: 0, collection: i.collection.address as Address, tokenId: BigInt(i.tokenId), anyToken: false, price: i.priceWei,
    maxFeeBps: Number(feeBps), maxRoyaltyBps: royaltyOf.get(i.collection.address.toLowerCase()) ?? 0, expiry, salt: randomSalt(), counter: counter as bigint,
  }));
  if (orders.length === 1) return signOrder(ctx, market, orders[0]);
  ctx.progress('sign');
  const signature = await signTypedData(wagmiConfig, {
    account: ctx.address,
    domain: { name: 'STABLE Market', version: '1', chainId: activeChain.id, verifyingContract: market },
    types: { BulkOrder: [{ name: 'orders', type: 'Order[]' }], Order: ORDER_TYPES.Order },
    primaryType: 'BulkOrder',
    message: { orders },
  });
  ctx.progress('save');
  return api.post<{ saved: { hash: string }[]; failed: { tokenId: string; err: string }[] }>('/orders/bulk', { orders: orders.map(serialize), signature });
}
export const BULK_SIGNATURE_PREFIX = BULK_MAGIC;

/** Cancel your listings on many items in ONE transaction. */
export async function bulkDelist(ctx: ActionCtx, items: { collection: string; tokenId: string }[]) {
  const { market } = need(ctx.cfg);
  const list = await myActiveListings(ctx.address, items);
  if (!list.length) throw new Error('None of these items has an open listing of yours.');
  const receipt = await send(ctx, { address: market, abi: marketAbi, functionName: 'cancel', args: [list.map((o) => toStruct(o.order_json!.order))] });
  await sync(ctx, receipt.transactionHash);
  return { cancelled: list.length };
}

/**
 * Send many of your NFTs to one wallet in ONE transaction (through the marketplace's transferBatch, which can only
 * move the caller's own NFTs). A single NFT is sent straight from your wallet, with no approval needed.
 */
export async function bulkTransfer(ctx: ActionCtx, a: { items: { collection: string; tokenId: string }[]; to: string }) {
  if (!isAddress(a.to)) throw new Error('Enter a valid wallet address (0x…).');
  const to = a.to as Address;
  if (to.toLowerCase() === ctx.address.toLowerCase()) throw new Error('That is your own wallet.');
  if (!a.items.length || a.items.length > 100) throw new Error('Choose 1 to 100 items.');
  for (const it of a.items) await assertOwner(ctx, it.collection as Address, it.tokenId);
  let receipt: TransactionReceipt;
  if (a.items.length === 1) {
    const it = a.items[0];
    receipt = await send(ctx, { address: it.collection as Address, abi: collectionAbi, functionName: 'safeTransferFrom', args: [ctx.address, to, BigInt(it.tokenId)] }, 'transfer');
  } else {
    const { market } = need(ctx.cfg);
    const version = await read<bigint>({ address: market, abi: marketAbi, functionName: 'version' }).catch(() => 0n);
    if (version < 3n) throw new Error('Batch sending needs the latest marketplace contract. Send items one by one for now.');
    for (const c of [...new Set(a.items.map((i) => i.collection.toLowerCase()))]) await ensureNftApproval(ctx, c as Address, market);
    receipt = await send(ctx, {
      address: market, abi: marketAbi, functionName: 'transferBatch',
      args: [a.items.map((i) => ({ collection: i.collection as Address, tokenId: BigInt(i.tokenId), to }))],
    }, 'transfer');
  }
  await sync(ctx, receipt.transactionHash);
  return { sent: a.items.length };
}

// ── Security tools ──────────────────────────────────────────────────────────
/** Cancels every listing and offer you have signed on the marketplace, in one transaction. */
export async function cancelAllOrders(ctx: ActionCtx) {
  const { market } = need(ctx.cfg);
  const receipt = await send(ctx, { address: market, abi: marketAbi, functionName: 'incrementCounter' });
  await sync(ctx, receipt.transactionHash);
}

/** Removes a marketplace's permission to move a collection's NFTs from your wallet. */
export async function revokeNftApproval(ctx: ActionCtx, collection: string, operator: string) {
  await send(ctx, { address: collection as Address, abi: collectionAbi, functionName: 'setApprovalForAll', args: [operator as Address, false] }, 'revoke');
}

/** Sets a marketplace's WETH allowance back to zero. */
export async function revokeWeth(ctx: ActionCtx, spender: string) {
  await send(ctx, { address: WETH as Address, abi: wethAbi, functionName: 'approve', args: [spender as Address, 0n] }, 'revoke');
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
  // Approve exactly what your open offers can spend (never more than you hold, never an unlimited amount).
  const needed = a.outstandingWei + a.priceWei;
  const target = needed < balance ? needed : balance;
  if (allowance < target) {
    await send(ctx, { address: weth, abi: wethAbi, functionName: 'approve', args: [market, target] }, 'approveWeth');
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

export async function acceptOffer(ctx: ActionCtx, a: { order: Order; collection: string; tokenId: string; minProceeds: bigint }) {
  const { market } = need(ctx.cfg);
  const signed = await loadSigned(a.order.hash);
  const o = toStruct(signed.order);
  // The offer must be for this collection (and this item), at least the price shown, and not expired.
  const ok = orderHashOf(market, o) === a.order.hash.toLowerCase() && o.side === 1 && same(o.collection, a.collection)
    && (o.anyToken || o.tokenId === BigInt(a.tokenId)) && o.price >= BigInt(a.order.price_wei) && o.expiry > BigInt(Math.floor(Date.now() / 1000));
  if (!ok) throw new Error(ORDER_MISMATCH);
  await assertOwner(ctx, o.collection, a.tokenId);
  await ensureNftApproval(ctx, o.collection, market);
  const receipt = await send(ctx, {
    address: market, abi: marketAbi, functionName: 'acceptOffer', args: [o, signed.signature, BigInt(a.tokenId), a.minProceeds],
  });
  await sync(ctx, receipt.transactionHash);
}

// ── Launchpad ───────────────────────────────────────────────────────────────
export async function mint(ctx: ActionCtx, a: { collection: string; phaseIndex: number; quantity: number; proof: `0x${string}`[]; expectedPriceWei?: bigint }) {
  const collection = a.collection as Address;
  await assertLaunchpadCollection(ctx.cfg, collection);
  // The price is read from the contract at the moment of minting, never from the API.
  const phases = await read<readonly { price: bigint; startTime: bigint }[]>({ address: collection, abi: collectionAbi, functionName: 'getPhases' });
  const phase = phases[a.phaseIndex];
  if (!phase) throw new Error('This mint phase does not exist.');
  // Never pay more than the price the page showed: if the creator changed it, stop and let the user look again.
  if (a.expectedPriceWei !== undefined && phase.price > a.expectedPriceWei) {
    throw new Error(`The mint price just changed to ${Number(phase.price) / 1e18} ETH. Nothing was sent. Check the new price and try again.`);
  }
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
