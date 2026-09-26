// ABIs for the STABLE contracts on GIWA (see /contracts).
const orderTuple = {
  name: 'o',
  type: 'tuple',
  components: [
    { name: 'maker', type: 'address' },
    { name: 'side', type: 'uint8' },
    { name: 'collection', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'anyToken', type: 'bool' },
    { name: 'price', type: 'uint256' },
    { name: 'maxFeeBps', type: 'uint16' },
    { name: 'maxRoyaltyBps', type: 'uint16' },
    { name: 'expiry', type: 'uint64' },
    { name: 'salt', type: 'uint256' },
    { name: 'counter', type: 'uint256' },
  ],
} as const;

/** v3 bulk listing: one signature over every order (the wallet shows each one). */
export const BULK_MAGIC = '5354424b';
export const ORDER_TYPES = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'side', type: 'uint8' },
    { name: 'collection', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'anyToken', type: 'bool' },
    { name: 'price', type: 'uint256' },
    { name: 'maxFeeBps', type: 'uint16' },
    { name: 'maxRoyaltyBps', type: 'uint16' },
    { name: 'expiry', type: 'uint64' },
    { name: 'salt', type: 'uint256' },
    { name: 'counter', type: 'uint256' },
  ],
} as const;

export const marketAbi = [
  ...['OrderUnavailable', 'OrderExpired', 'StaleCounter', 'BadSignature', 'CollectionNotTradable', 'ZeroPrice', 'FeeChanged',
    'RoyaltyChanged', 'SelfFill', 'WrongToken', 'InvalidBatch', 'NothingFilled', 'NotMaker', 'TransferFailed', 'InvalidOrder', 'EnforcedPause',
    'NotAuthorized', 'InvalidRecipient']
    .map((name) => ({ type: 'error', name, inputs: [] }) as const),
  { type: 'error', name: 'WrongPayment', inputs: [{ name: 'expected', type: 'uint256' }, { name: 'received', type: 'uint256' }] },
  { type: 'error', name: 'ProceedsTooLow', inputs: [{ name: 'proceeds', type: 'uint256' }, { name: 'minimum', type: 'uint256' }] },
  { type: 'function', name: 'buy', stateMutability: 'payable', inputs: [orderTuple, { name: 'signature', type: 'bytes' }], outputs: [] },
  {
    type: 'function', name: 'buyBatch', stateMutability: 'payable',
    inputs: [{ ...orderTuple, name: 'orders', type: 'tuple[]' }, { name: 'signatures', type: 'bytes[]' }],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
  {
    type: 'function', name: 'acceptOffer', stateMutability: 'nonpayable',
    inputs: [orderTuple, { name: 'signature', type: 'bytes' }, { name: 'tokenId', type: 'uint256' }, { name: 'minProceeds', type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'cancel', stateMutability: 'nonpayable', inputs: [{ ...orderTuple, name: 'orders', type: 'tuple[]' }], outputs: [] },
  { type: 'function', name: 'incrementCounter', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  // v3: send many of your own NFTs in one transaction (from = the caller, always)
  {
    type: 'function', name: 'transferBatch', stateMutability: 'nonpayable',
    inputs: [{ name: 'items', type: 'tuple[]', components: [{ name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'to', type: 'address' }] }],
    outputs: [],
  },
  { type: 'function', name: 'version', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'isTradable', stateMutability: 'view', inputs: [{ name: 'collection', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'counters', stateMutability: 'view', inputs: [{ name: 'maker', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'marketFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  {
    type: 'function', name: 'quote', stateMutability: 'view',
    inputs: [{ name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }],
    outputs: [{ name: 'fee', type: 'uint256' }, { name: 'royaltyReceiver', type: 'address' }, { name: 'royalty', type: 'uint256' }, { name: 'proceeds', type: 'uint256' }],
  },
  {
    type: 'event', name: 'OrderFilled',
    inputs: [
      { name: 'orderHash', type: 'bytes32', indexed: true }, { name: 'maker', type: 'address', indexed: true },
      { name: 'taker', type: 'address', indexed: true }, { name: 'side', type: 'uint8', indexed: false },
      { name: 'collection', type: 'address', indexed: false }, { name: 'tokenId', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false }, { name: 'fee', type: 'uint256', indexed: false },
      { name: 'royalty', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const phaseComponents = [
  { name: 'startTime', type: 'uint64' },
  { name: 'endTime', type: 'uint64' },
  { name: 'price', type: 'uint256' },
  { name: 'maxPerWallet', type: 'uint32' },
  { name: 'merkleRoot', type: 'bytes32' },
] as const;

export const collectionAbi = [
  ...['InvalidPhase', 'PhaseNotStarted', 'PhaseEnded', 'InvalidQuantity', 'ExceedsMaxSupply', 'ExceedsWalletLimit', 'NotAllowlisted', 'InvalidConfig',
    'MintIsPaused', 'PublicPhaseRequired', 'PhasesOutOfOrder']
    .map((name) => ({ type: 'error', name, inputs: [] }) as const),
  { type: 'error', name: 'WrongPayment', inputs: [{ name: 'expected', type: 'uint256' }, { name: 'received', type: 'uint256' }] },
  {
    type: 'function', name: 'mint', stateMutability: 'payable',
    inputs: [{ name: 'phaseId', type: 'uint256' }, { name: 'quantity', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }],
    outputs: [],
  },
  { type: 'function', name: 'getPhases', stateMutability: 'view', inputs: [], outputs: [{ type: 'tuple[]', components: phaseComponents }] },
  {
    type: 'function', name: 'mintedInPhase', stateMutability: 'view',
    inputs: [{ name: 'phaseId', type: 'uint256' }, { name: 'wallet', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'totalMinted', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'royaltyInfo', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'salePrice', type: 'uint256' }],
    outputs: [{ type: 'address' }, { type: 'uint256' }],
  },
  {
    type: 'function', name: 'isApprovedForAll', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [],
  },
  {
    type: 'function', name: 'safeTransferFrom', stateMutability: 'nonpayable',
    inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [],
  },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  {
    type: 'event', name: 'Transfer',
    inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'tokenId', type: 'uint256', indexed: true }],
  },
] as const;

export const factoryAbi = [
  ...['InvalidConfig', 'EnforcedPause', 'ZeroAddress', 'PublicPhaseRequired', 'PhasesOutOfOrder'].map((name) => ({ type: 'error', name, inputs: [] }) as const),
  { type: 'function', name: 'isCollection', stateMutability: 'view', inputs: [{ name: 'c', type: 'address' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function', name: 'createCollection', stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'p', type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'maxSupply', type: 'uint256' },
          { name: 'baseURI', type: 'string' },
          { name: 'unrevealedURI', type: 'string' },
          { name: 'royaltyReceiver', type: 'address' },
          { name: 'royaltyBps', type: 'uint96' },
          { name: 'payoutAddress', type: 'address' },
          { name: 'phases', type: 'tuple[]', components: phaseComponents },
        ],
      },
    ],
    outputs: [{ name: 'collection', type: 'address' }],
  },
  {
    type: 'event', name: 'CollectionCreated',
    inputs: [
      { name: 'collection', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'platformFeeBps', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const wethAbi = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }],
  },
] as const;

// ── Owner tools (Studio) ─────────────────────────────────────────────────────
const phaseInput = { name: 'ph', type: 'tuple', components: phaseComponents } as const;
const fn = (name: string, inputs: readonly any[] = [], outputs: readonly any[] = [], stateMutability = 'nonpayable') =>
  ({ type: 'function', name, inputs, outputs, stateMutability }) as const;
const view = (name: string, type: string, inputs: readonly any[] = []) => fn(name, inputs, [{ type }], 'view');

export const collectionOwnerAbi = [
  ...collectionAbi,
  view('owner', 'address'), view('revealed', 'bool'), view('metadataFrozen', 'bool'), view('mintPaused', 'bool'),
  view('payoutAddress', 'address'), view('contractURI', 'string'), view('platformFeeBps', 'uint16'),
  // v2 (single-transaction editing): replace every phase at once. keepIds[i] = id of the phase it continues, or 0 for new.
  fn('setPhases', [{ name: 'phases', type: 'tuple[]', components: phaseComponents }, { name: 'keepIds', type: 'uint32[]' }]),
  view('phaseIds', 'uint32[]'), view('version', 'uint256'),
  // v1 (collections created before the upgrade): one phase per transaction.
  fn('setPhase', [{ name: 'phaseId', type: 'uint256' }, phaseInput]),
  fn('addPhase', [phaseInput]),
  fn('setMintPaused', [{ name: 'paused', type: 'bool' }]),
  fn('reveal', [{ name: 'baseURI_', type: 'string' }]),
  fn('setBaseURI', [{ name: 'baseURI_', type: 'string' }]),
  fn('setUnrevealedURI', [{ name: 'uri', type: 'string' }]),
  fn('freezeMetadata'),
  fn('setRoyalty', [{ name: 'receiver', type: 'address' }, { name: 'bps', type: 'uint96' }]),
  fn('setPayoutAddress', [{ name: 'payout', type: 'address' }]),
  fn('withdraw'),
  fn('airdrop', [{ name: 'to', type: 'address[]' }, { name: 'quantities', type: 'uint256[]' }]),
  fn('reduceMaxSupply', [{ name: 'newMaxSupply', type: 'uint256' }]),
  fn('setContractURI', [{ name: 'uri', type: 'string' }]),
  { type: 'error', name: 'MetadataIsFrozen', inputs: [] },
  { type: 'error', name: 'InvalidRecipients', inputs: [] },
] as const;
