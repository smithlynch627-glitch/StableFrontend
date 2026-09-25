// Admin panel (internal tool, English). Roles: owner > admin > support. The API re-checks the role on every call.
// On-chain actions are sent from the connected wallet when it owns the contract; otherwise the panel copies
// the calldata so you can execute it from your Safe multisig.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { encodeFunctionData, isAddress, parseEther, type Address } from 'viem';
import { useAccount } from 'wagmi';
import { eth, short, timeAgo, dateTime } from '../lib/format';
import { factoryAdminAbi, marketAdminAbi, vaultAdminAbi } from '../lib/abis';
import { useAuthedApi, useTx } from '../lib/tx';
import type { Collection } from '../lib/types';
import { CollectionAvatar } from '../components/Art';
import { Badge, EmptyState, Modal, Skeleton, useToast } from '../components/ui';
import { useWalletUI } from '../components/wallet';

type Role = 'owner' | 'admin' | 'support';
type Tab = 'overview' | 'collections' | 'discover' | 'contracts' | 'network' | 'support' | 'team' | 'audit';
const TABS: [Tab, string, Role][] = [
  ['overview', 'Overview', 'support'], ['collections', 'Collections', 'admin'], ['discover', 'Import from GIWA', 'admin'],
  ['contracts', 'Contracts & fees', 'admin'], ['network', 'Network', 'owner'], ['support', 'Support tickets', 'support'],
  ['team', 'Team', 'owner'], ['audit', 'Audit log', 'admin'],
];
const RANK: Record<Role, number> = { support: 1, admin: 2, owner: 3 };

export default function Admin() {
  const { address } = useAccount();
  const { openConnect } = useWalletUI();
  const authed = useAuthedApi();
  const [tab, setTab] = useState<Tab>('overview');
  const me = useQuery({ queryKey: ['admin-me', address], queryFn: () => authed.get<{ role: Role }>('/admin/me'), enabled: !!address, retry: false });

  if (!address) return <div className="page container"><EmptyState title="Connect an admin wallet" action={<button className="btn" onClick={openConnect}>Connect wallet</button>} /></div>;
  if (me.isLoading) return <div className="page container"><Skeleton h={300} r={14} /></div>;
  if (!me.data) return <div className="page container"><EmptyState title={(me.error as Error)?.message || 'This wallet is not an admin.'} action={<button className="btn btn--outline" onClick={() => me.refetch()}>Sign in again</button>} /></div>;
  const role = me.data.role;

  return (
    <div className="page container">
      <div className="page-head">
        <h1 className="h1">Admin</h1>
        <p className="small soft">Signed in as <span className="addr">{address}</span> <span className="pill">{role}</span></p>
      </div>
      <div className="panel-layout">
        <nav className="side-tabs" role="tablist">
          {TABS.filter(([, , min]) => RANK[role] >= RANK[min]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          {tab === 'overview' && <Overview />}
          {tab === 'collections' && <Collections />}
          {tab === 'discover' && <Discover />}
          {tab === 'contracts' && <Contracts />}
          {tab === 'network' && <Network />}
          {tab === 'support' && <Tickets />}
          {tab === 'team' && <Team />}
          {tab === 'audit' && <Audit />}
        </div>
      </div>
    </div>
  );
}

// ── shared ────────────────────────────────────────────────────────────────────
type ChainInfo = {
  ready: boolean; block: number; weth: string;
  market: { address: string; owner: string; paused: boolean; feeBps: number; feeRecipient: string };
  factory: { address: string; owner: string; paused: boolean; feeBps: number };
  vault: { address: string; owner: string; eth: string; weth: string };
};
function useChainInfo() {
  const authed = useAuthedApi();
  return useQuery({ queryKey: ['admin-chain'], queryFn: () => authed.get<ChainInfo>('/admin/chain'), refetchInterval: 20_000 });
}

/** Sends the tx if the connected wallet owns the contract, otherwise copies calldata for a Safe. */
function OwnerAction({ owner, label, call, outline }: { owner?: string; label: string; call: { address: string; abi: any; functionName: string; args?: any[] }; outline?: boolean }) {
  const { address } = useAccount();
  const { busy, run } = useTx();
  const toast = useToast();
  const isOwner = !!owner && owner.toLowerCase() === address?.toLowerCase();
  if (isOwner) {
    return (
      <button className={`btn btn--sm ${outline ? 'btn--outline' : ''}`} disabled={!!busy} onClick={() => run(label, { ...call, address: call.address as Address })}>
        {busy && <span className="spinner" />}{label}
      </button>
    );
  }
  return (
    <button className="btn btn--sm btn--outline" title={`Contract owner is ${owner}`} onClick={() => {
      const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args } as any);
      navigator.clipboard?.writeText(JSON.stringify({ to: call.address, value: '0', data }, null, 2));
      toast('Calldata copied. Paste it into your Safe (Transaction Builder → custom data).');
    }}>
      {label} (copy for multisig)
    </button>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="panel">
      <div className="panel__head"><span>{title}</span>{right}</div>
      <div className="panel__body" style={{ display: 'grid', gap: 14 }}>{children}</div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview() {
  const authed = useAuthedApi();
  const q = useQuery({ queryKey: ['admin-overview'], queryFn: () => authed.get<any>('/admin/overview'), refetchInterval: 30_000 });
  if (!q.data) return <Skeleton h={200} r={14} />;
  const s = q.data.stats;
  const cards: [string, string][] = [
    ['Network', `${q.data.network.name} (${q.data.network.chainId})`], ['Collections', `${s.collections} (${s.hidden_collections} hidden)`],
    ['Items indexed', s.tokens.toLocaleString()], ['Active orders', s.active_orders.toLocaleString()], ['Sales', s.sales.toLocaleString()],
    ['Volume (all time)', `${eth(s.volume_wei)} ETH`], ['Volume 24h', `${eth(s.volume_24h_wei)} ETH`], ['Mint fees earned', `${eth(s.mint_fees_wei)} ETH`],
    ['Trading fees earned', `${eth(s.trade_fees_wei)} ETH/WETH`], ['Users', s.users.toLocaleString()],
    ['Open tickets', String(q.data.tickets.open)], ['Waiting on user', String(q.data.tickets.waiting)],
  ];
  return <div className="stat-cards">{cards.map(([k, v]) => <div key={k} className="stat-card"><span className="small muted">{k}</span><span className="v">{v}</span></div>)}</div>;
}

// ── Collections ──────────────────────────────────────────────────────────────
function Collections() {
  const authed = useAuthedApi();
  const toast = useToast();
  const qc = useQueryClient();
  const chain = useChainInfo();
  const [term, setTerm] = useState('');
  const [edit, setEdit] = useState<Collection | null>(null);
  const q = useQuery({ queryKey: ['admin-collections', term], queryFn: () => authed.get<{ collections: Collection[] }>('/admin/collections', { q: term }) });
  async function patch(c: Collection, body: Record<string, unknown>) {
    try {
      await authed.patch(`/admin/collections/${c.address}`, body);
      qc.invalidateQueries({ queryKey: ['admin-collections'] });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  async function refresh(c: Collection) {
    try {
      const r = await authed.post<{ tokens: number }>(`/admin/collections/${c.address}/refresh`);
      toast(`Refreshing ${r.tokens} items`);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  const m = chain.data?.market;
  return (
    <>
      <input className="input" placeholder="Search name or address" value={term} onChange={(e) => setTerm(e.target.value)} />
      {!q.data ? <Skeleton h={300} r={14} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Collection</th><th>Verified</th><th>Featured</th><th>Hidden</th><th>Trading</th><th /></tr></thead>
            <tbody>
              {q.data.collections.map((c) => (
                <tr key={c.address}>
                  <td>
                    <Link to={`/collection/${c.slug}`} className="cell-item">
                      <span className="thumb thumb--sm" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></span>
                      <span style={{ display: 'grid' }}>
                        <span className="row strong" style={{ gap: 6 }}>{c.name}<Badge official={c.is_official} verified={c.verified} size={14} /></span>
                        <span className="tiny muted">{short(c.address)}{c.is_external ? ' (imported)' : ''}</span>
                      </span>
                    </Link>
                  </td>
                  {(['verified', 'featured', 'hidden'] as const).map((f) => (
                    <td key={f}><input type="checkbox" className="switch" checked={Boolean(c[f])} onChange={(e) => patch(c, { [f]: e.target.checked })} /></td>
                  ))}
                  <td>
                    {m && (c.tradable
                      ? <OwnerAction owner={m.owner} label="Block" outline call={{ address: m.address, abi: marketAdminAbi, functionName: 'setCollectionBlocked', args: [c.address, true] }} />
                      : <div className="row" style={{ gap: 6 }}>
                          {c.is_external && <OwnerAction owner={m.owner} label="Enable" call={{ address: m.address, abi: marketAdminAbi, functionName: 'setCollectionApproval', args: [c.address, true] }} />}
                          <OwnerAction owner={m.owner} label="Unblock" outline call={{ address: m.address, abi: marketAdminAbi, functionName: 'setCollectionBlocked', args: [c.address, false] }} />
                        </div>)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => refresh(c)}>Refresh</button>
                      <button className="btn btn--outline btn--sm" onClick={() => setEdit(c)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <EditCollection c={edit} onClose={() => setEdit(null)} onSave={(b) => patch(edit, b).then(() => setEdit(null))} />}
    </>
  );
}

function EditCollection({ c, onClose, onSave }: { c: Collection; onClose: () => void; onSave: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ name: c.name, slug: c.slug, description: c.description || '', image_url: c.image_url || '', banner_url: c.banner_url || '', twitter: c.twitter || '', website: c.website || '' });
  return (
    <Modal open onClose={onClose} title={`Edit ${c.name}`} width={560}>
      {(Object.keys(f) as (keyof typeof f)[]).map((k) => (
        <div className="field" key={k}>
          <label>{k.replace('_', ' ')}</label>
          {k === 'description' ? <textarea className="textarea" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
        </div>
      ))}
      <button className="btn btn--block" onClick={() => onSave({ ...f, image_url: f.image_url || null, banner_url: f.banner_url || null, twitter: f.twitter || null, website: f.website || null })}>Save</button>
    </Modal>
  );
}

// ── Discover / import existing GIWA collections ───────────────────────────────
type Found = { address: string; name: string; symbol: string; holders: number; totalSupply: string | null; imported: boolean };
function Discover() {
  const authed = useAuthedApi();
  const toast = useToast();
  const [pages, setPages] = useState<(Record<string, unknown> | null)[]>([null]);
  const page = pages[pages.length - 1];
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-discover', page], queryFn: () => authed.get<{ items: Found[]; next: Record<string, unknown> | null }>('/admin/discover', page ? { page: JSON.stringify(page) } : undefined), retry: false });
  async function doImport(address: string) {
    setBusy(address);
    try {
      const r = await authed.post<{ tokens: number; tradable: boolean }>('/admin/import', { address });
      toast(`Imported ${r.tokens} items${r.tradable ? '' : '. Enable trading in Collections to allow listings.'}`);
      q.refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Section title="Import by address">
        <div className="row">
          <input className="input" placeholder="0x… ERC-721 contract on the active network" value={manual} onChange={(e) => setManual(e.target.value.trim())} />
          <button className="btn" disabled={!isAddress(manual.toLowerCase()) || !!busy} onClick={() => doImport(manual.toLowerCase())}>{busy === manual && <span className="spinner" />}Import</button>
        </div>
        <p className="tiny muted">Imported collections show on the marketplace right away. Trading needs one on-chain approval (Collections tab), which protects buyers from fake contracts.</p>
      </Section>
      <Section title="ERC-721 collections on this network (from the block explorer)">
        {q.isError ? <p className="notice">{(q.error as Error).message}</p> : !q.data ? <Skeleton h={240} r={12} /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Address</th><th className="num">Holders</th><th className="num">Supply</th><th /></tr></thead>
                <tbody>
                  {q.data.items.map((it) => (
                    <tr key={it.address}>
                      <td className="strong">{it.name} <span className="muted small">{it.symbol}</span></td>
                      <td className="addr">{short(it.address)}</td>
                      <td className="num">{it.holders.toLocaleString()}</td>
                      <td className="num">{it.totalSupply ? Number(it.totalSupply).toLocaleString() : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className={`btn btn--sm ${it.imported ? 'btn--outline' : ''}`} disabled={!!busy} onClick={() => doImport(it.address)}>
                          {busy === it.address && <span className="spinner" />}{it.imported ? 'Re-sync' : 'Import'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row">
              <button className="btn btn--outline btn--sm" disabled={pages.length < 2} onClick={() => setPages(pages.slice(0, -1))}>Previous</button>
              <button className="btn btn--outline btn--sm" disabled={!q.data.next} onClick={() => setPages([...pages, q.data!.next])}>Next</button>
            </div>
          </>
        )}
      </Section>
    </>
  );
}

// ── Contracts & fees ─────────────────────────────────────────────────────────
function Contracts() {
  const chain = useChainInfo();
  const [mFee, setMFee] = useState('');
  const [fFee, setFFee] = useState('');
  const [to, setTo] = useState('');
  const [wethAmt, setWethAmt] = useState('');
  const d = chain.data;
  if (chain.isLoading) return <Skeleton h={300} r={14} />;
  if (!d?.ready) return <p className="notice">Contract addresses are not set for this network. Add them in the Network tab.</p>;
  const pct = (v: string) => Math.round(Number(v) * 100);
  return (
    <>
      <Section title="Marketplace" right={<span className="pill">{d.market.paused ? 'Paused' : 'Live'}</span>}>
        <div className="small soft">Contract <span className="addr">{d.market.address}</span>, owner <span className="addr">{d.market.owner}</span></div>
        <div className="row-wrap">
          <span>Trading fee: <strong>{d.market.feeBps / 100}%</strong></span>
          <input className="input" style={{ width: 120 }} placeholder="new %" value={mFee} onChange={(e) => setMFee(e.target.value.replace(/[^0-9.]/g, ''))} />
          <OwnerAction owner={d.market.owner} label="Set fee" call={{ address: d.market.address, abi: marketAdminAbi, functionName: 'setMarketFeeBps', args: [pct(mFee)] }} />
          <span className="tiny muted">Max 10%. Raising it invalidates open orders (never overcharges).</span>
        </div>
        <div className="row-wrap">
          <OwnerAction owner={d.market.owner} label={d.market.paused ? 'Unpause trading' : 'Pause trading'} outline call={{ address: d.market.address, abi: marketAdminAbi, functionName: d.market.paused ? 'unpause' : 'pause' }} />
          <span className="tiny muted">Pausing stops buys and accepts. Users can always cancel.</span>
        </div>
      </Section>
      <Section title="Launchpad factory" right={<span className="pill">{d.factory.paused ? 'Paused' : 'Live'}</span>}>
        <div className="small soft">Contract <span className="addr">{d.factory.address}</span>, owner <span className="addr">{d.factory.owner}</span></div>
        <div className="row-wrap">
          <span>Mint fee for new collections: <strong>{d.factory.feeBps / 100}%</strong></span>
          <input className="input" style={{ width: 120 }} placeholder="new %" value={fFee} onChange={(e) => setFFee(e.target.value.replace(/[^0-9.]/g, ''))} />
          <OwnerAction owner={d.factory.owner} label="Set fee" call={{ address: d.factory.address, abi: factoryAdminAbi, functionName: 'setPlatformFeeBps', args: [pct(fFee)] }} />
          <span className="tiny muted">Max 20%. Existing collections keep their fee.</span>
        </div>
        <OwnerAction owner={d.factory.owner} label={d.factory.paused ? 'Unpause launches' : 'Pause launches'} outline call={{ address: d.factory.address, abi: factoryAdminAbi, functionName: d.factory.paused ? 'unpause' : 'pause' }} />
      </Section>
      <Section title="Fee vault">
        <div className="small soft">Contract <span className="addr">{d.vault.address}</span>, owner <span className="addr">{d.vault.owner}</span></div>
        <div className="stat-cards">
          <div className="stat-card"><span className="small muted">ETH</span><span className="v">{eth(d.vault.eth, 6)}</span></div>
          <div className="stat-card"><span className="small muted">WETH</span><span className="v">{eth(d.vault.weth, 6)}</span></div>
        </div>
        <div className="field"><label>Send to</label><input className="input" placeholder="0x… (treasury)" value={to} onChange={(e) => setTo(e.target.value.trim())} /></div>
        {isAddress(to.toLowerCase()) && (
          <div className="row-wrap">
            <OwnerAction owner={d.vault.owner} label="Withdraw all ETH" call={{ address: d.vault.address, abi: vaultAdminAbi, functionName: 'withdrawAllEth', args: [to.toLowerCase()] }} />
            <input className="input" style={{ width: 160 }} placeholder="WETH amount" value={wethAmt} onChange={(e) => setWethAmt(e.target.value.replace(/[^0-9.]/g, ''))} />
            {Number(wethAmt) > 0 && <OwnerAction owner={d.vault.owner} label="Withdraw WETH" outline call={{ address: d.vault.address, abi: vaultAdminAbi, functionName: 'withdrawToken', args: [d.weth, to.toLowerCase(), parseEther(wethAmt as `${number}`)] }} />}
          </div>
        )}
      </Section>
    </>
  );
}

// ── Network (owner) ──────────────────────────────────────────────────────────
type Net = Record<string, any>;
const NET_FIELDS: [string, string][] = [
  ['name', 'Display name'], ['rpc_url', 'Server RPC URL (can be private)'], ['public_rpc_url', 'Browser RPC URL (https)'],
  ['explorer_url', 'Explorer URL'], ['explorer_api_url', 'Explorer API v2 URL (Blockscout, for imports)'], ['market_address', 'StableMarket address'],
  ['factory_address', 'Launchpad factory address'], ['fee_vault_address', 'FeeVault address'], ['weth_address', 'WETH address'],
  ['official_collection', 'GIWA COWS address'], ['start_block', 'Indexer start block'],
];

function Network() {
  const authed = useAuthedApi();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-networks'], queryFn: () => authed.get<{ networks: Net[] }>('/admin/networks') });
  const [adding, setAdding] = useState(false);
  async function activate(n: Net) {
    const typed = window.prompt(`Switch the WHOLE marketplace to "${n.name}" (chain ${n.chain_id})?\nType the key "${n.key}" to confirm.`);
    if (typed !== n.key) return;
    try {
      await authed.post(`/admin/networks/${n.key}/activate`, { confirm: typed });
      toast(`Switched to ${n.name}. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  if (!q.data) return <Skeleton h={300} r={14} />;
  return (
    <>
      <p className="notice">
        To move to GIWA mainnet: deploy the contracts on mainnet, add the network here with its RPC and addresses, press Test, then Activate.
        Every API instance, the indexer and the website switch within seconds. Testnet data is kept, so you can switch back.
      </p>
      {q.data.networks.map((n) => <NetworkCard key={n.key} n={n} onActivate={() => activate(n)} onSaved={() => q.refetch()} />)}
      {adding ? <NetworkCard n={{ key: '', chain_id: '', is_testnet: false, weth_address: '0x4200000000000000000000000000000000000006' }} isNew onSaved={() => { setAdding(false); q.refetch(); }} /> : <button className="btn btn--outline" style={{ justifySelf: 'start' }} onClick={() => setAdding(true)}>Add network</button>}
    </>
  );
}

function NetworkCard({ n, isNew, onActivate, onSaved }: { n: Net; isNew?: boolean; onActivate?: () => void; onSaved: () => void }) {
  const authed = useAuthedApi();
  const toast = useToast();
  const [f, setF] = useState<Net>({ ...n });
  const [checks, setChecks] = useState<{ check: string; ok: boolean; detail: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const body = () => Object.fromEntries([...NET_FIELDS.map(([k]) => [k, f[k] === '' ? null : f[k]]), ['is_testnet', !!f.is_testnet]]);
  async function save() {
    setBusy(true);
    try {
      const r = isNew
        ? await authed.post<{ checks: any[] }>('/admin/networks', { ...body(), key: f.key, chain_id: Number(f.chain_id) })
        : await authed.put<{ checks: any[] }>(`/admin/networks/${n.key}`, body());
      setChecks(r.checks);
      toast('Saved');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    try {
      setChecks((await authed.post<{ checks: any[] }>(`/admin/networks/${n.key}/test`)).checks);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  return (
    <Section title={isNew ? 'New network' : `${n.name} (chain ${n.chain_id})`} right={n.is_active ? <span className="pill pill--live">Active</span> : undefined}>
      <div className="kv-form">
        {isNew && <div className="field"><label>Key (e.g. giwa-mainnet)</label><input className="input" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase() })} /></div>}
        {isNew && <div className="field"><label>Chain ID</label><input className="input" inputMode="numeric" value={f.chain_id} onChange={(e) => setF({ ...f, chain_id: e.target.value.replace(/\D/g, '') })} /></div>}
        {NET_FIELDS.map(([k, label]) => (
          <div className="field" key={k}><label>{label}</label><input className="input" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value.trim() })} /></div>
        ))}
        <label className="checkbox"><input type="checkbox" className="switch" checked={!!f.is_testnet} onChange={(e) => setF({ ...f, is_testnet: e.target.checked })} />Testnet</label>
      </div>
      {checks && (
        <div style={{ display: 'grid', gap: 4 }}>
          {checks.map((c) => <div key={c.check} className="small">{c.ok ? '✓' : '✗'} <strong>{c.check}</strong> {c.detail}</div>)}
        </div>
      )}
      <div className="row-wrap">
        <button className="btn" disabled={busy} onClick={save}>{busy && <span className="spinner" />}{isNew ? 'Add and test' : 'Save and test'}</button>
        {!isNew && <button className="btn btn--outline" onClick={test}>Test</button>}
        {!isNew && !n.is_active && <button className="btn btn--outline" onClick={onActivate}>Activate</button>}
        {!isNew && <span className="tiny muted">Last change {n.updated_at ? timeAgo(n.updated_at, 'en') : '—'} by {n.updated_by ? short(n.updated_by) : '—'}</span>}
      </div>
    </Section>
  );
}

// ── Support tickets ──────────────────────────────────────────────────────────
function Tickets() {
  const authed = useAuthedApi();
  const [status, setStatus] = useState('open');
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-tickets', status], queryFn: () => authed.get<{ tickets: any[] }>('/admin/tickets', { status }), refetchInterval: 30_000 });
  if (open) return <TicketAdmin id={open} onBack={() => { setOpen(null); q.refetch(); }} />;
  return (
    <>
      <div className="row-wrap">{['open', 'waiting', 'resolved', 'closed', ''].map((s) => <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{s || 'all'}</button>)}</div>
      {!q.data ? <Skeleton h={200} r={14} /> : q.data.tickets.length === 0 ? <EmptyState title="No tickets" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ticket</th><th>From</th><th>Topic</th><th>Priority</th><th>Updated</th></tr></thead>
            <tbody>
              {q.data.tickets.map((x) => (
                <tr key={x.id} className="clickable" onClick={() => setOpen(x.id)}>
                  <td><div className="strong">{x.subject}</div><div className="tiny muted">{x.ref}, {x.messages} messages, {x.status}</div></td>
                  <td className="addr">{short(x.address)}</td><td>{x.category}</td><td><span className="pill">{x.priority}</span></td>
                  <td className="muted">{timeAgo(x.last_message_at, 'en')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TicketAdmin({ id, onBack }: { id: string; onBack: () => void }) {
  const authed = useAuthedApi();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('waiting');
  const q = useQuery({ queryKey: ['admin-ticket', id], queryFn: () => authed.get<{ ticket: any; messages: any[] }>(`/admin/tickets/${id}`) });
  async function send() {
    try {
      await authed.post(`/admin/tickets/${id}/reply`, { body: reply, status });
      setReply('');
      q.refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  async function setField(body: Record<string, string>) {
    await authed.patch(`/admin/tickets/${id}`, body).catch((e) => toast(e.message, 'error'));
    q.refetch();
  }
  if (!q.data) return <Skeleton h={300} r={14} />;
  const t = q.data.ticket;
  return (
    <Section title={`${t.ref}: ${t.subject}`} right={<button className="btn btn--ghost btn--sm" onClick={onBack}>Back</button>}>
      <div className="kv">
        <div><dt>From</dt><dd className="addr"><Link className="link" to={`/profile/${t.address}`}>{t.address}</Link></dd></div>
        <div><dt>Contact (decrypted)</dt><dd>{t.contact || '—'}</dd></div>
        <div><dt>Topic</dt><dd>{t.category}</dd></div>
        {t.tx_hash && <div><dt>Transaction</dt><dd className="addr">{t.tx_hash}</dd></div>}
        {t.collection && <div><dt>Collection</dt><dd className="addr">{t.collection} {t.token_id ? `#${t.token_id}` : ''}</dd></div>}
      </div>
      <div className="row-wrap">
        <select className="select" style={{ width: 'auto' }} value={t.status} onChange={(e) => setField({ status: e.target.value })}>{['open', 'waiting', 'resolved', 'closed'].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="select" style={{ width: 'auto' }} value={t.priority} onChange={(e) => setField({ priority: e.target.value })}>{['low', 'normal', 'high', 'urgent'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="thread">
        {q.data.messages.map((m) => (
          <div key={m.id} className={`msg ${m.is_staff ? 'is-staff' : ''}`}>
            <div className="tiny" style={{ opacity: 0.7, marginBottom: 4 }}>{m.is_staff ? `Staff ${short(m.author)}` : 'User'}, {dateTime(m.created_at, 'en')}</div>
            {m.body}
          </div>
        ))}
      </div>
      <textarea className="textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the user" />
      <div className="row">
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>{['waiting', 'resolved', 'closed', 'open'].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn" disabled={!reply.trim()} onClick={send}>Send reply</button>
      </div>
    </Section>
  );
}

// ── Team (owner) & audit ─────────────────────────────────────────────────────
function Team() {
  const authed = useAuthedApi();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-team'], queryFn: () => authed.get<{ admins: any[] }>('/admin/admins') });
  const [addr, setAddr] = useState('');
  const [role, setRole] = useState('support');
  const act = (p: Promise<unknown>) => p.then(() => q.refetch()).catch((e) => toast(e.message, 'error'));
  return (
    <>
      <Section title="Add or change a team member">
        <div className="row-wrap">
          <input className="input" style={{ flex: 1, minWidth: 260 }} placeholder="0x… wallet" value={addr} onChange={(e) => setAddr(e.target.value.trim())} />
          <select className="select" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value)}>{['support', 'admin', 'owner'].map((r) => <option key={r}>{r}</option>)}</select>
          <button className="btn" disabled={!isAddress(addr.toLowerCase())} onClick={() => act(authed.post('/admin/admins', { address: addr.toLowerCase(), role }))}>Save</button>
        </div>
        <p className="tiny muted">support: tickets only. admin: collections, imports, contracts, audit. owner: everything including networks and team.</p>
      </Section>
      {q.data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Wallet</th><th>Role</th><th>Added by</th><th /></tr></thead>
            <tbody>{q.data.admins.map((a) => (
              <tr key={a.address}><td className="addr">{a.address}</td><td><span className="pill">{a.role}</span></td><td className="muted">{a.root ? 'server env' : short(a.added_by)}</td>
                <td style={{ textAlign: 'right' }}>{!a.root && <button className="btn btn--ghost btn--sm" onClick={() => act(authed.del(`/admin/admins/${a.address}`))}>Remove</button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Audit() {
  const authed = useAuthedApi();
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => authed.get<{ entries: any[] }>('/admin/audit') });
  if (!q.data) return <Skeleton h={300} r={14} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>{q.data.entries.map((e) => (
          <tr key={e.id}><td className="muted">{dateTime(e.created_at, 'en')}</td><td className="addr">{short(e.actor)}</td><td className="strong">{e.action}</td>
            <td className="addr">{e.target && e.target.length > 20 ? short(e.target) : e.target}</td>
            <td className="tiny muted" style={{ maxWidth: 320, whiteSpace: 'normal' }}>{JSON.stringify(e.details).slice(0, 160)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
