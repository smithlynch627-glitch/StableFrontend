import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { useAppConfig } from '../lib/appConfig';
import { createCollection, type CreateForm } from '../lib/actions';
import { eth, num, toWei } from '../lib/format';
import type { Collection } from '../lib/types';
import { IconAlert, IconCheck, IconPlus } from '../components/Icons';
import { IpfsFolderUpload, readAddressFile } from '../components/IpfsUpload';
import { ImageField, MetadataCheck, PreRevealPicker } from '../components/CreateArt';
import { RunnerStatus, useRunner } from '../components/trade';
import { Modal } from '../components/ui';
import { useWalletUI } from '../components/wallet';

const STEPS: DictKey[] = ['create.stepDetails', 'create.stepSupply', 'create.stepPhases', 'create.stepEarnings', 'create.stepReview'];
const ADDR = /^0x[0-9a-fA-F]{40}$/;

const pad = (n: number) => String(n).padStart(2, '0');
function localInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const parseList = (text: string) => text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

type PhaseForm = {
  name: string; start: string; end: string; priceEth: string; maxPerWallet: number; useAllowlist: boolean; allowlist: string[]; allowlistText: string;
};

function newPhase(i: number): PhaseForm {
  const start = new Date(Date.now() + (i === 0 ? 3600e3 : 86400e3 * (i + 1)));
  const end = new Date(start.getTime() + 86400e3 * (i === 0 ? 1 : 7));
  return { name: i === 0 ? 'Allowlist' : 'Public', start: localInput(start), end: localInput(end), priceEth: '0.0002', maxPerWallet: i === 0 ? 2 : 10, useAllowlist: i === 0, allowlist: [], allowlistText: '' };
}

export default function Create() {
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const { address, isConnected } = useAccount();
  const { openConnect, ensureReady } = useWalletUI();
  const runner = useRunner();
  const [step, setStep] = useState(0);
  const [artMode, setArtMode] = useState<'prereveal' | 'ipfs' | 'cid'>('prereveal');
  const [metaOk, setMetaOk] = useState(false);
  const [reached, setReached] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Collection | null>(null);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({
    name: '', symbol: '', description: '', imageUrl: null as string | null, bannerUrl: null as string | null, twitter: '', website: '',
    discord: '', telegram: '', maxSupply: '', baseUri: '', revealLater: true, unrevealedUri: '', royaltyPct: '5', royaltyReceiver: '', payoutAddress: '',
  });
  const [phases, setPhases] = useState<PhaseForm[]>([newPhase(0), newPhase(1)]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const setPhase = (i: number, patch: Partial<PhaseForm>) => setPhases((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  function validate(s: number): string | null {
    if (s === 0) {
      if (!f.name.trim()) return t('create.errName');
      if (!/^[A-Za-z0-9]{2,10}$/.test(f.symbol)) return t('create.errSymbol');
      if (f.description.trim().length < 20) return t('create.errDesc');
      if (!f.imageUrl) return t('create.errLogo');
      if (!/^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/.test(f.twitter.trim())) return t('create.errX');
      for (const v of [f.discord, f.telegram, f.website]) if (v.trim() && !/^https:\/\/\S+$/.test(v.trim())) return t('create.errLink');
    }
    if (s === 1) {
      const n = Number(f.maxSupply);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return t('create.errSupply');
      const uri = (f.revealLater ? f.unrevealedUri : f.baseUri).trim();
      const onchainPre = f.revealLater && uri.startsWith('data:application/json;base64,');
      if (!onchainPre && !/^(ipfs:\/\/|https:\/\/|ar:\/\/)/i.test(uri)) return t('create.errUri');
      if (!f.revealLater && !metaOk) return t('meta.required');
    }
    if (s === 2) {
      for (const [i, p] of phases.entries()) {
        const start = new Date(p.start).getTime();
        const end = p.end ? new Date(p.end).getTime() : Infinity;
        if (!p.start || Number.isNaN(start) || end <= start || toWei(p.priceEth || '0') === null) return t('create.errPhase', { n: i + 1 });
        if (p.useAllowlist && !parseList(p.allowlistText).some((a) => ADDR.test(a))) return t('create.errAllowlist', { n: i + 1 });
      }
    }
    if (s === 3) {
      const r = Number(f.royaltyPct);
      if (!(r >= 0 && r <= 10)) return t('create.errRoyalty');
      if (f.royaltyReceiver && !ADDR.test(f.royaltyReceiver)) return t('create.errReceiver');
      if (f.payoutAddress && !ADDR.test(f.payoutAddress)) return t('create.errReceiver');
    }
    return null;
  }

  function go(to: number) {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = validate(s);
        if (e) { setError(e); return; }
      }
    }
    setError(null);
    setStep(to);
    setReached((r) => Math.max(r, to));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deploy() {
    for (let s = 0; s < 4; s++) {
      const e = validate(s);
      if (e) { setError(e); setStep(s); return; }
    }
    if (!(await ensureReady())) return;
    setModal(true);
    const form: CreateForm = {
      name: f.name.trim(), symbol: f.symbol.toUpperCase(), description: f.description, imageUrl: f.imageUrl, bannerUrl: f.bannerUrl,
      twitter: f.twitter.trim(), website: f.website.trim(), discord: f.discord.trim(), telegram: f.telegram.trim(), maxSupply: Number(f.maxSupply), baseUri: f.baseUri, revealLater: f.revealLater,
      unrevealedUri: f.unrevealedUri, royaltyBps: Math.round(Number(f.royaltyPct) * 100), royaltyReceiver: f.royaltyReceiver || address || '',
      payoutAddress: f.payoutAddress || address || '',
      phases: phases.map((p) => ({
        name: p.name, start: p.start, end: p.end, priceWei: toWei(p.priceEth || '0') ?? 0n, maxPerWallet: p.maxPerWallet,
        useAllowlist: p.useAllowlist, allowlist: p.useAllowlist ? parseList(p.allowlistText).filter((a) => ADDR.test(a)) : [],
      })),
    };
    const col = await runner.run((ctx) => createCollection(ctx, form));
    if (col) setCreated(col);
  }

  const lastPrice = toWei(phases[phases.length - 1]?.priceEth || '0') ?? 0n;
  const gross = lastPrice * BigInt(Number(f.maxSupply) || 0);
  const mintFeeBps = cfg.mintFeeBps ?? 1000;
  const platformPct = mintFeeBps / 100;
  const marketPct = (cfg.marketFeeBps ?? 200) / 100;

  return (
    <div className="page container">
      <div className="page-head">
        <h1 className="h1">{t('create.title')}</h1>
        <p className="lead">{t('create.sub')}</p>
      </div>

      {!isConnected && (
        <div className="notice" style={{ marginBottom: 24, alignItems: 'center' }}>
          <IconAlert size={18} /><span style={{ flex: 1 }}>{t('create.connect')}</span>
          <button className="btn btn--sm" onClick={openConnect}>{t('wallet.connect')}</button>
        </div>
      )}

      <div className="wizard">
        <ol className="wizard__steps">
          {STEPS.map((key, i) => (
            <li key={key}>
              <button className={i === step ? 'is-current' : i < step || i <= reached ? 'is-done' : ''} onClick={() => go(i)} disabled={i > reached + 1}>
                <span className="num">{i < step ? <IconCheck size={14} /> : i + 1}</span>{t(key)}
              </button>
            </li>
          ))}
        </ol>

        <div className="wizard__panel" key={step}>
          <h2 className="h2">{t(STEPS[step])}</h2>

          {step === 0 && (
            <>
              <div className="grid-2">
                <div className="field"><label htmlFor="c-name">{t('create.name')}<span className="req">*</span></label><input id="c-name" className="input" maxLength={64} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="GIWA COWS" /></div>
                <div className="field"><label htmlFor="c-sym">{t('create.symbol')}<span className="req">*</span></label><input id="c-sym" className="input" maxLength={10} value={f.symbol} onChange={(e) => set('symbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="COWS" /><span className="hint">{t('create.symbolHint')}</span></div>
              </div>
              <div className="field"><label htmlFor="c-desc">{t('create.description')}<span className="req">*</span></label><textarea id="c-desc" className="textarea" maxLength={2000} value={f.description} onChange={(e) => set('description', e.target.value)} /><span className="hint">{f.description.trim().length}/2000</span></div>
              <div className="image-fields">
                <ImageField label={t('create.logo')} required spec={{ w: 400, h: 400 }} square maxDim={800} value={f.imageUrl} onChange={(u) => set('imageUrl', u)} />
                <ImageField label={t('create.banner')} spec={{ w: 1500, h: 500 }} maxDim={2000} value={f.bannerUrl} onChange={(u) => set('bannerUrl', u)} />
              </div>
              <div className="grid-2">
                <div className="field"><label htmlFor="c-x">{t('create.twitter')}<span className="req">*</span></label><input id="c-x" className="input" value={f.twitter} onChange={(e) => set('twitter', e.target.value.trim())} placeholder="https://x.com/yourcollection" /></div>
                <div className="field"><label htmlFor="c-dc">{t('create.discord')} <span className="muted">({t('create.optional')})</span></label><input id="c-dc" className="input" value={f.discord} onChange={(e) => set('discord', e.target.value.trim())} placeholder="https://discord.gg/..." /></div>
                <div className="field"><label htmlFor="c-tg">{t('create.telegram')} <span className="muted">({t('create.optional')})</span></label><input id="c-tg" className="input" value={f.telegram} onChange={(e) => set('telegram', e.target.value.trim())} placeholder="https://t.me/..." /></div>
                <div className="field"><label htmlFor="c-web">{t('create.website')} <span className="muted">({t('create.optional')})</span></label><input id="c-web" className="input" value={f.website} onChange={(e) => set('website', e.target.value.trim())} placeholder="https://" /></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="field" style={{ maxWidth: 260 }}><label htmlFor="c-sup">{t('create.maxSupply')}<span className="req">*</span></label><input id="c-sup" className="input" inputMode="numeric" value={f.maxSupply} placeholder={t('create.supplyPh')} onChange={(e) => set('maxSupply', e.target.value.replace(/\D/g, ''))} /></div>
              <span className="label">{t('art.title')}</span>
              <div className="art-options">
                {([
                  ['prereveal', t('art.prereveal'), t('art.prerevealBody')],
                  ['ipfs', t('art.ipfs'), t('art.ipfsBody')],
                  ['cid', t('art.cid'), t('art.cidBody')],
                ] as const).map(([id, title, body]) => (
                  <button key={id} type="button" className={`art-option ${artMode === id ? 'is-active' : ''} ${id === 'ipfs' && !cfg.ipfsUploads ? 'is-off' : ''}`} onClick={() => { setArtMode(id); set('revealLater', id === 'prereveal'); }}>
                    <span className="strong">{title}</span>
                    <span className="small soft">{id === 'ipfs' && !cfg.ipfsUploads ? t('art.ipfsOff') : body}</span>
                  </button>
                ))}
              </div>
              {artMode === 'prereveal' && (
                <PreRevealPicker name={f.name} description={f.description} value={f.unrevealedUri} onChange={(uri) => set('unrevealedUri', uri)} />
              )}
              {artMode === 'ipfs' && cfg.ipfsUploads && (
                <>
                  <IpfsFolderUpload expected={Number(f.maxSupply) || undefined} onDone={(uri) => { set('baseUri', uri); setMetaOk(false); }} />
                  {f.baseUri && <><div className="small soft ellipsis"><IconCheck size={14} /> {f.baseUri}</div><MetadataCheck baseUri={f.baseUri} onResult={setMetaOk} /></>}
                </>
              )}
              {artMode === 'cid' && (
                <>
                  <div className="field"><label htmlFor="c-uri">{t('create.baseUri')}<span className="req">*</span></label><input id="c-uri" className="input" value={f.baseUri} onChange={(e) => { set('baseUri', e.target.value.trim()); setMetaOk(false); }} placeholder="ipfs://bafy.../" /><span className="hint">{t('create.baseUriHint')}</span></div>
                  <MetadataCheck baseUri={f.baseUri} onResult={setMetaOk} />
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {phases.map((p, i) => {
                const list = parseList(p.allowlistText);
                const valid = list.filter((a) => ADDR.test(a)).length;
                return (
                  <div className="phase-editor" key={i}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="strong">{i + 1}. {p.name || t('create.phaseName')}</span>
                      {phases.length > 1 && <button className="btn btn--ghost btn--sm" onClick={() => setPhases((ps) => ps.filter((_, j) => j !== i))}>{t('create.removePhase')}</button>}
                    </div>
                    <div className="grid-3">
                      <div className="field"><label>{t('create.phaseName')}</label><input className="input" maxLength={32} value={p.name} onChange={(e) => setPhase(i, { name: e.target.value })} /></div>
                      <div className="field"><label>{t('create.priceEth')}</label><input className="input" inputMode="decimal" value={p.priceEth} onChange={(e) => setPhase(i, { priceEth: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} /></div>
                      <div className="field"><label>{t('create.maxPerWallet')}</label><input className="input" inputMode="numeric" value={p.maxPerWallet || ''} onChange={(e) => setPhase(i, { maxPerWallet: Number(e.target.value.replace(/\D/g, '')) })} /></div>
                    </div>
                    <div className="grid-2">
                      <div className="field"><label>{t('create.start')}</label><input className="input" type="datetime-local" value={p.start} onChange={(e) => setPhase(i, { start: e.target.value })} /></div>
                      <div className="field"><label>{t('create.end')}</label><input className="input" type="datetime-local" value={p.end} onChange={(e) => setPhase(i, { end: e.target.value })} /></div>
                    </div>
                    <label className="checkbox"><input type="checkbox" className="switch" checked={p.useAllowlist} onChange={(e) => setPhase(i, { useAllowlist: e.target.checked })} />{t('create.useAllowlist')}</label>
                    {p.useAllowlist && (
                      <div className="field">
                        <label>{t('create.allowlist')}</label>
                        <textarea className="textarea" value={p.allowlistText} onChange={(e) => setPhase(i, { allowlistText: e.target.value })} placeholder="0x..." style={{ fontSize: 13 }} />
                        <label className="btn btn--sm btn--outline" style={{ justifySelf: 'start', cursor: 'pointer' }}>
                          {t('art.csv')}
                          <input type="file" hidden accept=".csv,.txt,text/csv,text/plain" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setPhase(i, { allowlistText: (await readAddressFile(file)).join('\n') }); }} />
                        </label>
                        <span className="hint">{t('create.allowlistCount', { n: valid })}{list.length > valid ? `. ${t('create.allowlistInvalid', { n: list.length - valid })}` : ''}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {phases.length < 5 && <button className="btn btn--outline" style={{ justifySelf: 'start' }} onClick={() => setPhases((ps) => [...ps, newPhase(ps.length)])}><IconPlus size={16} />{t('create.addPhase')}</button>}
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid-2">
                <div className="field"><label htmlFor="c-roy">{t('create.royalty')}</label><div className="input-wrap"><input id="c-roy" className="input" inputMode="decimal" value={f.royaltyPct} onChange={(e) => set('royaltyPct', e.target.value.replace(/[^0-9.]/g, ''))} /><span className="suffix">%</span></div></div>
                <div className="field"><label htmlFor="c-rr">{t('create.royaltyReceiver')}</label><input id="c-rr" className="input" value={f.royaltyReceiver} onChange={(e) => set('royaltyReceiver', e.target.value.trim())} placeholder={address || '0x...'} /></div>
              </div>
              <div className="field"><label htmlFor="c-pay">{t('create.payout')}</label><input id="c-pay" className="input" value={f.payoutAddress} onChange={(e) => set('payoutAddress', e.target.value.trim())} placeholder={address || '0x...'} /></div>
              <div className="card card--pad" style={{ display: 'grid', gap: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="strong">{t('fees.title')}</span><span className="tiny muted">{t('fees.live')}</span></div>
                <div className="sum-rows">
                  <div><span className="muted">{t('fees.mint')}</span><span className="strong">{platformPct}%</span></div>
                  <div><span className="muted">{t('fees.market')}</span><span className="strong">{marketPct}%</span></div>
                  <div><span className="muted">{t('fees.royalty')}</span><span className="strong">{Number(f.royaltyPct) || 0}%</span></div>
                </div>
                <div className="small soft">{t('fees.marketBody')}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>{t('fees.sale')}</div>
                <div className="sum-rows">
                  <div><span className="muted">{t('fees.market')} ({marketPct}%)</span><span className="mono-num">{(marketPct / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} ETH</span></div>
                  <div><span className="muted">{t('fees.royalty')} ({Number(f.royaltyPct) || 0}%)</span><span className="mono-num">{((Number(f.royaltyPct) || 0) / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} ETH</span></div>
                  <div className="total"><span>{t('fees.seller')}</span><span className="mono-num">{(1 - marketPct / 100 - (Number(f.royaltyPct) || 0) / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} ETH</span></div>
                </div>
              </div>
              <div className="card card--pad" style={{ display: 'grid', gap: 14 }}>
                <div className="strong">{t('create.payoutTitle')}</div>
                <div className="split-bar">
                  <div className="you" style={{ width: `${100 - platformPct}%` }}>{t('create.payoutYou')} {100 - platformPct}%</div>
                  <div className="fee" style={{ width: `${platformPct}%`, minWidth: 90 }}>{platformPct}%</div>
                </div>
                <div className="small soft">{t('create.example', { n: num(Number(f.maxSupply) || 0, lang) })}</div>
                <div className="sum-rows">
                  <div><span className="muted">{t('common.total')}</span><span className="mono-num">{eth(gross)} ETH</span></div>
                  <div><span className="muted">{t('create.payoutPlatform')} ({platformPct}%)</span><span className="mono-num">{eth((gross * BigInt(mintFeeBps)) / 10000n)} ETH</span></div>
                  <div className="total"><span>{t('create.payoutYou')}</span><span className="mono-num">{eth(gross - (gross * BigInt(mintFeeBps)) / 10000n)} ETH</span></div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="review-list">
                <div><span className="muted">{t('create.name')}</span><span className="strong">{f.name} ({f.symbol})</span></div>
                <div><span className="muted">{t('create.maxSupply')}</span><span className="strong">{num(Number(f.maxSupply), lang)}</span></div>
                <div><span className="muted">{t('create.twitter')}</span><span className="strong ellipsis">{f.twitter}</span></div>
                {f.discord && <div><span className="muted">{t('create.discord')}</span><span className="strong ellipsis">{f.discord}</span></div>}
                {f.telegram && <div><span className="muted">{t('create.telegram')}</span><span className="strong ellipsis">{f.telegram}</span></div>}
                {phases.map((p, i) => (
                  <div key={i}><span className="muted">{i + 1}. {p.name}</span><span className="row-wrap" style={{ justifyContent: 'flex-end', gap: 6 }}><span className="pill">{Number(p.priceEth) ? `${p.priceEth} ETH` : t('lp.free')}</span><span className="pill pill--outline">{p.maxPerWallet ? t('drop.limit', { n: p.maxPerWallet }) : t('drop.noLimit')}</span>{p.useAllowlist && <span className="pill pill--outline">{t('drop.allowlist')}</span>}</span></div>
                ))}
                <div><span className="muted">{t('create.royalty')}</span><span className="strong">{f.royaltyPct}%</span></div>
                <div><span className="muted">{t('drop.platformFee')}</span><span className="strong">{platformPct}%</span></div>
              </div>
              <div className="notice"><IconAlert size={16} />{t('create.reviewNote')}</div>
              {!cfg.ready && <div className="notice notice--strong"><IconAlert size={16} />{t('create.errNotReady')}</div>}
            </>
          )}

          {error && <div className="notice notice--strong"><IconAlert size={16} />{error}</div>}

          <div className="wizard__nav">
            <button className="btn btn--outline" onClick={() => go(step - 1)} disabled={step === 0}>{t('create.back')}</button>
            {step < 4 ? (
              <button className="btn" onClick={() => go(step + 1)}>{t('create.next')}</button>
            ) : (
              <button className="btn btn--lg" onClick={deploy} disabled={!isConnected || !cfg.ready}>{t('create.deploy')}</button>
            )}
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); runner.reset(); }} title={t('create.deploy')} locked={runner.busy}>
        <RunnerStatus
          runner={runner}
          successText={t('create.done')}
          onClose={() => { setModal(false); runner.reset(); }}
          extra={created && (
            <div style={{ display: 'grid', gap: 8 }}>
              <p className="small soft" style={{ margin: 0 }}>{t('create.whereNext')}</p>
              <Link className="btn btn--block" to={`/launchpad/${created.slug}`}>{t('lp.view')}</Link>
              <Link className="btn btn--outline btn--block" to={`/studio/${created.slug}`}>{t('create.manage')}</Link>
              <Link className="btn btn--ghost btn--block" to={`/collection/${created.slug}`}>{t('create.viewCollection')}</Link>
            </div>
          )}
        />
      </Modal>
    </div>
  );
}
