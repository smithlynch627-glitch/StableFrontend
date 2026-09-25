// Creator Studio: everything a collection owner can change after launch. All changes are on-chain.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAddress, zeroHash, type Address } from 'viem';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { activeChain } from '../config';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { api } from '../lib/api';
import { collectionOwnerAbi } from '../lib/abis';
import { eth, num, toWei } from '../lib/format';
import type { Collection, DropState } from '../lib/types';
import { useAuthedApi, useTx } from '../lib/tx';
import { CollectionAvatar } from '../components/Art';
import { IpfsFolderUpload, PreRevealUpload, readAddressFile } from '../components/IpfsUpload';
import { EmptyState, Skeleton, useToast } from '../components/ui';
import { useWalletUI } from '../components/wallet';
import { BackButton } from '../components/BackButton';

type Tab = 'overview' | 'phases' | 'metadata' | 'airdrop' | 'settings';
type ChainPhase = { startTime: bigint; endTime: bigint; price: bigint; maxPerWallet: number; merkleRoot: `0x${string}` };

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (sec: bigint) => {
  if (!sec) return '';
  const d = new Date(Number(sec) * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toSec = (v: string) => (v ? BigInt(Math.floor(new Date(v).getTime() / 1000)) : 0n);
const ADDR = /^0x[0-9a-fA-F]{40}$/;

export default function Studio() {
  const { slug = '' } = useParams();
  const { t } = useI18n();
  const { address } = useAccount();
  const { openConnect } = useWalletUI();
  const [tab, setTab] = useState<Tab>('overview');
  const q = useQuery({ queryKey: ['collection', slug.toLowerCase()], queryFn: () => api.get<{ collection: Collection; drop: DropState | null }>(`/collections/${slug}`) });
  const c = q.data?.collection;
  const addr = c?.address as Address | undefined;
  const fns = ['owner', 'revealed', 'metadataFrozen', 'mintPaused', 'payoutAddress', 'contractURI', 'getPhases', 'maxSupply', 'totalMinted'] as const;
  const reads = useReadContracts({
    contracts: [
      ...fns.map((functionName) => ({ address: addr, abi: collectionOwnerAbi, functionName, chainId: activeChain.id })),
      { address: addr, abi: collectionOwnerAbi, functionName: 'royaltyInfo', args: [1n, 10_000n], chainId: activeChain.id },
    ] as any,
    query: { enabled: !!addr },
  });
  const r = (i: number) => reads.data?.[i]?.result as any;
  const owner = r(0) as string | undefined;
  const isOwner = !!owner && !!address && owner.toLowerCase() === address.toLowerCase();

  if (q.isLoading || (addr && reads.isLoading)) return <div className="page container"><Skeleton h={400} r={14} /></div>;
  if (!c) return <div className="page container"><EmptyState title={t('col.notFound')} /></div>;
  if (!address) return <div className="page container"><EmptyState title={t('studio.notOwner')} action={<button className="btn" onClick={openConnect}>{t('wallet.connect')}</button>} /></div>;
  if (c.is_external || !isOwner) return <div className="page container"><EmptyState title={t('studio.notOwner')} /></div>;

  const state = {
    revealed: Boolean(r(1)), frozen: Boolean(r(2)), paused: Boolean(r(3)), payout: String(r(4) || ''), contractUri: String(r(5) || ''),
    phases: (r(6) || []) as ChainPhase[], maxSupply: Number(r(7) || 0), minted: Number(r(8) || 0), royalty: r(9) as [string, bigint] | undefined,
  };
  const tabs: [Tab, DictKey][] = [['overview', 'studio.tabOverview'], ['phases', 'studio.tabPhases'], ['metadata', 'studio.tabMetadata'], ['airdrop', 'studio.tabAirdrop'], ['settings', 'studio.tabSettings']];

  return (
    <div className="page container">
      <div className="back-row"><BackButton fallback={`/collection/${c.slug}`} /></div>
      <div className="row" style={{ gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div className="thumb" style={{ width: 64, height: 64, borderRadius: 16, position: 'relative' }}><CollectionAvatar collection={c} /></div>
        <div style={{ flex: 1 }}>
          <div className="small muted">{t('studio.title')}</div>
          <h1 className="h1">{c.name}</h1>
          <p className="small soft">{t('studio.sub')}</p>
        </div>
        <Link className="btn btn--outline btn--sm" to={`/collection/${c.slug}`}>{t('home.viewCollection')}</Link>
        <Link className="btn btn--outline btn--sm" to={`/launchpad/${c.slug}`}>{t('lp.view')}</Link>
      </div>
      <div className="panel-layout">
        <nav className="side-tabs" role="tablist">
          {tabs.map(([id, key]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{t(key)}</button>)}
        </nav>
        <div style={{ display: 'grid', gap: 22 }}>
          {tab === 'overview' && <Overview c={c} addr={addr!} s={state} />}
          {tab === 'phases' && <Phases c={c} addr={addr!} phases={state.phases} names={q.data?.drop?.phases.map((p) => p.name) ?? []} />}
          {tab === 'metadata' && <Metadata c={c} addr={addr!} s={state} />}
          {tab === 'airdrop' && <Airdrop addr={addr!} left={state.maxSupply - state.minted} />}
          {tab === 'settings' && <Settings c={c} addr={addr!} s={state} />}
        </div>
      </div>
    </div>
  );
}

type S = { revealed: boolean; frozen: boolean; paused: boolean; payout: string; contractUri: string; maxSupply: number; minted: number; royalty?: [string, bigint] };

function Overview({ c, addr, s }: { c: Collection; addr: Address; s: S }) {
  const { t, lang } = useI18n();
  const { busy, run } = useTx();
  const bal = useBalance({ address: addr, chainId: activeChain.id });
  return (
    <>
      <div className="stat-cards">
        <div className="stat-card"><span className="small muted">{t('studio.revenue')}</span><span className="v mono-num">{eth(bal.data?.value ?? 0n, 6)} ETH</span></div>
        <div className="stat-card"><span className="small muted">{t('cows.minted')}</span><span className="v mono-num">{num(s.minted, lang)} / {num(s.maxSupply, lang)}</span></div>
        <div className="stat-card"><span className="small muted">{t('common.volume')}</span><span className="v mono-num">{eth(c.volume_wei)} ETH</span></div>
        <div className="stat-card"><span className="small muted">{t('common.owners')}</span><span className="v mono-num">{num(c.owners_count, lang)}</span></div>
      </div>
      <div className="card card--pad" style={{ display: 'grid', gap: 12 }}>
        <div className="small soft">{t('studio.payout')}: <span className="addr">{s.payout}</span></div>
        <div className="row-wrap">
          <button className="btn" disabled={!bal.data?.value || !!busy} onClick={() => run('withdraw', { address: addr, abi: collectionOwnerAbi, functionName: 'withdraw' })}>
            {busy === 'withdraw' && <span className="spinner" />}{t('studio.withdraw')}
          </button>
          <button className="btn btn--outline" disabled={!!busy} onClick={() => run('pause', { address: addr, abi: collectionOwnerAbi, functionName: 'setMintPaused', args: [!s.paused] })}>
            {busy === 'pause' && <span className="spinner" />}{s.paused ? t('studio.resume') : t('studio.pause')}
          </button>
          <span className="pill">{s.paused ? t('studio.paused') : t('studio.live')}</span>
        </div>
      </div>
    </>
  );
}

function Phases({ c, addr, phases, names }: { c: Collection; addr: Address; phases: ChainPhase[]; names: string[] }) {
  const { t } = useI18n();
  return (
    <>
      {phases.map((p, i) => <PhaseForm key={`${i}-${p.merkleRoot}-${p.price}`} c={c} addr={addr} index={i} phase={p} name={names[i] || `Phase ${i + 1}`} allNames={names} />)}
      {phases.length < 5 && <PhaseForm c={c} addr={addr} index={phases.length} name={`Phase ${phases.length + 1}`} allNames={names} />}
      <p className="tiny muted">{t('fee.wallet')}</p>
    </>
  );
}

function PhaseForm({ c, addr, index, phase, name, allNames }: { c: Collection; addr: Address; index: number; phase?: ChainPhase; name: string; allNames: string[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const authed = useAuthedApi();
  const { busy, run } = useTx();
  const gated = !!phase && phase.merkleRoot !== zeroHash;
  const [f, setF] = useState({
    name, start: phase ? toInput(phase.startTime) : '', end: phase ? toInput(phase.endTime) : '',
    price: phase ? eth(phase.price, 10).replace(/,/g, '') : '0', max: phase ? String(phase.maxPerWallet || '') : '',
    mode: (gated ? 'keep' : 'none') as 'keep' | 'new' | 'none', list: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const valid = useMemo(() => (f.list.match(/0x[0-9a-fA-F]{40}/g) || []).length, [f.list]);

  async function save() {
    const price = toWei(f.price || '0');
    if (price === null || !f.start || (f.end && toSec(f.end) <= toSec(f.start))) return toast(t('create.errPhase', { n: index + 1 }), 'error');
    let root: `0x${string}` = f.mode === 'keep' && phase ? phase.merkleRoot : zeroHash;
    let allowlistId: string | null = null;
    if (f.mode === 'new') {
      const list = f.list.match(/0x[0-9a-fA-F]{40}/g) || [];
      if (!list.length) return toast(t('create.errAllowlist', { n: index + 1 }), 'error');
      const al = await authed.post<{ id: string; root: `0x${string}` }>('/drops/allowlists', { addresses: list });
      root = al.root;
      allowlistId = al.id;
    }
    const ph = { startTime: toSec(f.start), endTime: toSec(f.end), price, maxPerWallet: Number(f.max || 0), merkleRoot: root };
    const receipt = phase
      ? await run('save', { address: addr, abi: collectionOwnerAbi, functionName: 'setPhase', args: [BigInt(index), ph] })
      : await run('save', { address: addr, abi: collectionOwnerAbi, functionName: 'addPhase', args: [ph] });
    if (!receipt) return;
    const meta = [...allNames];
    meta[index] = f.name;
    await authed.post('/drops', { collection: c.address, phases: meta.map((n, i) => ({ name: n || `Phase ${i + 1}`, ...(i === index && allowlistId ? { allowlistId } : {}) })) }).catch(() => undefined);
  }

  return (
    <div className="phase-editor">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="strong">{index + 1}. {phase ? f.name : t('studio.addPhase')}</span>
        {gated && <span className="pill">{t('drop.allowlist')}</span>}
      </div>
      <div className="grid-3">
        <div className="field"><label>{t('create.phaseName')}</label><input className="input" maxLength={32} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>{t('create.priceEth')}</label><input className="input" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} /></div>
        <div className="field"><label>{t('create.maxPerWallet')}</label><input className="input" inputMode="numeric" value={f.max} placeholder="0 = no limit" onChange={(e) => set('max', e.target.value.replace(/\D/g, ''))} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>{t('create.start')}</label><input className="input" type="datetime-local" value={f.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div className="field"><label>{t('create.end')}</label><input className="input" type="datetime-local" value={f.end} onChange={(e) => set('end', e.target.value)} /></div>
      </div>
      <div className="row-wrap">
        {gated && <button type="button" className="chip" aria-pressed={f.mode === 'keep'} onClick={() => set('mode', 'keep')}>{t('studio.allowlistKeep')}</button>}
        <button type="button" className="chip" aria-pressed={f.mode === 'new'} onClick={() => set('mode', 'new')}>{t('studio.allowlistNew')}</button>
        <button type="button" className="chip" aria-pressed={f.mode === 'none'} onClick={() => set('mode', 'none')}>{t('studio.allowlistNone')}</button>
      </div>
      {f.mode === 'new' && (
        <div className="field">
          <textarea className="textarea" value={f.list} onChange={(e) => set('list', e.target.value)} placeholder="0x..." style={{ fontSize: 13 }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="hint">{t('create.allowlistCount', { n: valid })}</span>
            <label className="btn btn--sm btn--outline" style={{ cursor: 'pointer' }}>{t('art.csv')}
              <input type="file" hidden accept=".csv,.txt" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set('list', (await readAddressFile(file)).join('\n')); }} />
            </label>
          </div>
        </div>
      )}
      <button className="btn" style={{ justifySelf: 'start' }} disabled={!!busy} onClick={save}>{busy && <span className="spinner" />}{phase ? t('studio.savePhase') : t('studio.addPhase')}</button>
    </div>
  );
}

function Metadata({ c, addr, s }: { c: Collection; addr: Address; s: S }) {
  const { t } = useI18n();
  const { busy, run } = useTx();
  const [uri, setUri] = useState('');
  if (s.frozen) return <div className="notice notice--strong">{t('studio.frozen')}</div>;
  const validUri = /^(ipfs:\/\/|https:\/\/|ar:\/\/)/.test(uri.trim());
  return (
    <>
      <div className="row-wrap"><span className="pill">{s.revealed ? t('studio.revealed') : t('studio.unrevealed')}</span></div>
      {!s.revealed && (
        <div className="card card--pad" style={{ display: 'grid', gap: 12 }}>
          <span className="strong">{t('studio.changePre')}</span>
          <PreRevealUpload name={c.name} onDone={(u) => run('pre', { address: addr, abi: collectionOwnerAbi, functionName: 'setUnrevealedURI', args: [u] })} />
        </div>
      )}
      <div className="card card--pad" style={{ display: 'grid', gap: 12 }}>
        <span className="strong">{s.revealed ? t('studio.updateBase') : t('studio.revealWith')}</span>
        <IpfsFolderUpload expected={c.max_supply || undefined} onDone={setUri} />
        <div className="field"><label>{t('create.baseUri')}</label><input className="input" value={uri} onChange={(e) => setUri(e.target.value.trim())} placeholder="ipfs://CID/" /><span className="hint">{t('create.baseUriHint')}</span></div>
        <button className="btn" style={{ justifySelf: 'start' }} disabled={!validUri || !!busy}
          onClick={() => run('reveal', { address: addr, abi: collectionOwnerAbi, functionName: s.revealed ? 'setBaseURI' : 'reveal', args: [uri.trim()] })}>
          {busy === 'reveal' && <span className="spinner" />}{s.revealed ? t('studio.updateBase') : t('studio.revealWith')}
        </button>
      </div>
      {s.revealed && (
        <div className="card card--pad" style={{ display: 'grid', gap: 10 }}>
          <span className="strong">{t('studio.freeze')}</span>
          <span className="small soft">{t('studio.freezeWarn')}</span>
          <button className="btn btn--outline" style={{ justifySelf: 'start' }} disabled={!!busy}
            onClick={() => window.confirm(t('studio.freezeWarn')) && run('freeze', { address: addr, abi: collectionOwnerAbi, functionName: 'freezeMetadata' })}>
            {t('studio.freeze')}
          </button>
        </div>
      )}
    </>
  );
}

function Airdrop({ addr, left }: { addr: Address; left: number }) {
  const { t } = useI18n();
  const { busy, run } = useTx();
  const [text, setText] = useState('');
  const rows = text.split(/\n+/).map((l) => l.split(/[,;\s]+/).filter(Boolean)).filter((p) => p.length && ADDR.test(p[0]));
  const to = rows.map((p) => p[0].toLowerCase() as Address);
  const qty = rows.map((p) => BigInt(Math.max(1, Number(p[1] || 1) | 0)));
  const total = qty.reduce((a, b) => a + Number(b), 0);
  return (
    <div className="card card--pad" style={{ display: 'grid', gap: 12 }}>
      <label className="label">{t('studio.airdropHint')}</label>
      <textarea className="textarea" style={{ minHeight: 180, fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'0x1234...abcd, 2\n0x5678...ef01, 1'} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small soft">{t('studio.airdropCount', { n: to.length, q: total })} ({t('drop.remaining', { n: left })})</span>
        <button className="btn" disabled={!to.length || total > left || to.length > 200 || total > 500 || !!busy}
          onClick={() => run('airdrop', { address: addr, abi: collectionOwnerAbi, functionName: 'airdrop', args: [to, qty] })}>
          {busy && <span className="spinner" />}{t('studio.airdropSend')}
        </button>
      </div>
    </div>
  );
}

function Settings({ c, addr, s }: { c: Collection; addr: Address; s: S }) {
  const { t } = useI18n();
  const toast = useToast();
  const authed = useAuthedApi();
  const { busy, run } = useTx();
  const [payout, setPayout] = useState(s.payout);
  const [royalty, setRoyalty] = useState(String(Number(s.royalty?.[1] ?? 0n) / 100));
  const [receiver, setReceiver] = useState(String(s.royalty?.[0] || c.creator || ''));
  const [supply, setSupply] = useState(String(s.maxSupply));
  const [curi, setCuri] = useState(s.contractUri);
  const [d, setD] = useState({ description: c.description || '', twitter: c.twitter || '', discord: c.discord || '', telegram: c.telegram || '', website: c.website || '' });
  useEffect(() => setPayout(s.payout), [s.payout]);

  async function saveProfile() {
    try {
      await authed.post('/drops', { collection: c.address, ...d });
      toast(t('profile.saved'));
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  const bps = Math.round(Number(royalty) * 100);
  return (
    <>
      <div className="card card--pad kv-form">
        <div className="field"><label>{t('studio.payout')}</label><input className="input" value={payout} onChange={(e) => setPayout(e.target.value.trim())} />
          <button className="btn btn--sm" style={{ justifySelf: 'start' }} disabled={!isAddress(payout.toLowerCase()) || !!busy} onClick={() => run('payout', { address: addr, abi: collectionOwnerAbi, functionName: 'setPayoutAddress', args: [payout.toLowerCase()] })}>{t('common.save')}</button></div>
        <div className="field"><label>{t('studio.royalty')}</label><input className="input" inputMode="decimal" value={royalty} onChange={(e) => setRoyalty(e.target.value.replace(/[^0-9.]/g, ''))} />
          <label className="label" style={{ marginTop: 6 }}>{t('studio.royaltyReceiver')}</label><input className="input" value={receiver} onChange={(e) => setReceiver(e.target.value.trim())} />
          <span className="hint">{t('studio.royaltyWarn')}</span>
          <button className="btn btn--sm" style={{ justifySelf: 'start' }} disabled={!(bps >= 0 && bps <= 1000) || !isAddress(receiver.toLowerCase()) || !!busy} onClick={() => run('royalty', { address: addr, abi: collectionOwnerAbi, functionName: 'setRoyalty', args: [receiver.toLowerCase(), BigInt(bps)] })}>{t('studio.saveRoyalty')}</button></div>
        <div className="field"><label>{t('studio.reduceSupply')}</label><input className="input" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value.replace(/\D/g, ''))} />
          <span className="hint">{t('studio.reduceHint')}</span>
          <button className="btn btn--sm" style={{ justifySelf: 'start' }} disabled={!(Number(supply) < s.maxSupply && Number(supply) >= s.minted && Number(supply) > 0) || !!busy} onClick={() => run('supply', { address: addr, abi: collectionOwnerAbi, functionName: 'reduceMaxSupply', args: [BigInt(supply)] })}>{t('common.save')}</button></div>
        <div className="field"><label>{t('studio.contractUri')}</label><input className="input" value={curi} onChange={(e) => setCuri(e.target.value.trim())} placeholder="ipfs://.../collection.json" />
          <button className="btn btn--sm" style={{ justifySelf: 'start' }} disabled={!!busy} onClick={() => run('curi', { address: addr, abi: collectionOwnerAbi, functionName: 'setContractURI', args: [curi] })}>{t('studio.setContractUri')}</button></div>
      </div>
      <div className="card card--pad" style={{ display: 'grid', gap: 12 }}>
        <span className="strong">{t('studio.profile')}</span>
        <div className="field"><label>{t('create.description')}</label><textarea className="textarea" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
        <div className="grid-2">
          <div className="field"><label>{t('create.twitter')}</label><input className="input" value={d.twitter} onChange={(e) => setD({ ...d, twitter: e.target.value })} /></div>
          <div className="field"><label>{t('col.discord')}</label><input className="input" value={d.discord} placeholder="https://discord.gg/..." onChange={(e) => setD({ ...d, discord: e.target.value })} /></div>
        </div>
        <div className="grid-2">
          <div className="field"><label>{t('create.telegram')}</label><input className="input" value={d.telegram} placeholder="https://t.me/..." onChange={(e) => setD({ ...d, telegram: e.target.value })} /></div>
          <div className="field"><label>{t('create.website')}</label><input className="input" value={d.website} onChange={(e) => setD({ ...d, website: e.target.value })} /></div>
        </div>
        <button className="btn" style={{ justifySelf: 'start' }} onClick={saveProfile}>{t('studio.saveProfile')}</button>
      </div>
    </>
  );
}
