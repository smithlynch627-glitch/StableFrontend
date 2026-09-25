// IPFS uploads for creators.
// - Folder upload: images folder + metadata folder (1.json, 2.json, ...). The browser uploads straight to IPFS
//   (Pinata) with a single-use, upload-only key from our API, so the platform's Pinata secret never reaches the browser.
// - Pre-reveal: one image → placeholder metadata (IPFS, or hosted by the API when IPFS is not configured).
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { IMAGE_ACCEPT } from './CreateArt';
import { useAppConfig } from '../lib/appConfig';
import { useAuthedApi } from '../lib/tx';
import { errorMessage } from '../lib/actions';
import { IconAlert, IconCheck, IconClose } from './Icons';
import { Progress, useToast } from './ui';

const baseName = (p: string) => p.split('/').pop() || p;
const stem = (p: string) => baseName(p).replace(/\.[^.]+$/, '');

function uploadFolder(files: { file: Blob; path: string }[], jwt: string, endpoint: string, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const f of files) fd.append('file', f.file, f.path);
    fd.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    fd.append('pinataMetadata', JSON.stringify({ name: files[0]?.path.split('/')[0] || 'upload' }));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.IpfsHash) resolve(j.IpfsHash);
        else reject(new Error(j.error?.details || j.error || `IPFS upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`IPFS upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during IPFS upload'));
    xhr.send(fd);
  });
}

type Plan = {
  entries: { id: number; data: any }[];
  shift: number;
  missing: number[];
  dups: number[];
  invalid: string[];
  badNames: string[];
  images: Map<number, string>;
  unmatched: number[];
  placeholder: boolean;
};
const PLACEHOLDER = /NewUriToReplace|YOUR_?CID|REPLACE_?ME|<.*CID.*>/i;

/** Reads the chosen files and works out exactly what will be uploaded (before anything is uploaded). */
async function makePlan(meta: File[], images: File[]): Promise<Plan> {
  const invalid: string[] = [];
  const badNames: string[] = [];
  const raw: { id: number; data: any }[] = [];
  for (const f of meta) {
    const id = Number(stem(f.name));
    if (!Number.isInteger(id) || id < 0) { badNames.push(f.name); continue; }
    try {
      raw.push({ id, data: JSON.parse((await f.text()).replace(/^\uFEFF/, '')) });
    } catch {
      invalid.push(f.name);
    }
  }
  raw.sort((a, b) => a.id - b.id);
  const seen = new Set<number>();
  const dups: number[] = [];
  for (const e of raw) (seen.has(e.id) ? dups.push(e.id) : seen.add(e.id));
  // Files numbered 0…N-1: token numbers start at 1 here, so they are uploaded as 1…N.
  const shift = raw.length && raw[0].id === 0 ? 1 : 0;
  const entries = raw.map((e) => ({ id: e.id + shift, orig: e.id, data: e.data }));
  const max = entries.length ? entries[entries.length - 1].id : 0;
  const ids = new Set(entries.map((e) => e.id));
  const missing: number[] = [];
  for (let i = 1; i <= max; i++) if (!ids.has(i)) missing.push(i);
  // Match every metadata file to its image: by the file name in "image", then by number.
  const byName = new Map(images.map((f) => [baseName(f.name).toLowerCase(), baseName(f.name)]));
  const byStem = new Map(images.map((f) => [stem(f.name).toLowerCase(), baseName(f.name)]));
  const matched = new Map<number, string>();
  const unmatched: number[] = [];
  let placeholder = false;
  for (const e of entries) {
    const ref = typeof e.data?.image === 'string' ? e.data.image : '';
    if (PLACEHOLDER.test(ref)) placeholder = true;
    if (!images.length) continue;
    const refName = baseName(ref.split('?')[0]).toLowerCase();
    const file = byName.get(refName) || byStem.get(refName.replace(/\.[^.]+$/, '')) || byStem.get(String(e.orig)) || byStem.get(String(e.id));
    if (file) matched.set(e.id, file);
    else unmatched.push(e.id);
  }
  return { entries, shift, missing, dups, invalid, badNames, images: matched, unmatched, placeholder };
}

export function IpfsFolderUpload({ expected, onDone }: { expected?: number; onDone: (baseUri: string) => void }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const authed = useAuthedApi();
  const [images, setImages] = useState<File[]>([]);
  const [meta, setMeta] = useState<File[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reading, setReading] = useState(false);
  const [stage, setStage] = useState<'idle' | 'images' | 'json' | 'done'>('idle');
  const [pct, setPct] = useState(0);
  // Images already on IPFS for this exact selection: a retry only re-uploads the metadata.
  const uploaded = useRef<{ key: string; cid: string } | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const dirProps = { webkitdirectory: '', directory: '' } as any;
  const imagesKey = images.map((f) => `${f.name}:${f.size}`).join('|');

  useEffect(() => {
    if (!meta.length) { setPlan(null); return; }
    let alive = true;
    setReading(true);
    makePlan(meta, images).then((p) => alive && setPlan(p)).finally(() => alive && setReading(false));
    return () => { alive = false; };
  }, [meta, images]);

  if (!cfg.ipfsUploads) return <p className="notice">{t('art.noIpfs')}</p>;

  const count = plan?.entries.length ?? 0;
  const blocking = !plan || !count || plan.missing.length > 0 || plan.dups.length > 0 || plan.invalid.length > 0
    || (images.length > 0 && plan.unmatched.length > 0) || (!images.length && plan.placeholder);

  async function start() {
    if (!plan || blocking) return;
    try {
      let imageCid = '';
      if (images.length) {
        if (uploaded.current?.key === imagesKey) imageCid = uploaded.current.cid;
        else {
          setStage('images');
          setPct(0);
          const k1 = await authed.post<{ jwt: string; endpoint: string }>('/uploads/ipfs-key');
          imageCid = await uploadFolder(images.map((f) => ({ file: f, path: `images/${baseName(f.name)}` })), k1.jwt, k1.endpoint, setPct);
          uploaded.current = { key: imagesKey, cid: imageCid };
        }
      }
      const out = plan.entries.map(({ id, data }) => {
        const file = plan.images.get(id);
        const json = imageCid && file ? { ...data, image: `ipfs://${imageCid}/${encodeURIComponent(file)}` } : data;
        return { file: new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), path: `metadata/${id}.json` };
      });
      setStage('json');
      setPct(0);
      const k2 = await authed.post<{ jwt: string; endpoint: string }>('/uploads/ipfs-key');
      const metaCid = await uploadFolder(out, k2.jwt, k2.endpoint, setPct);
      setStage('done');
      onDone(`ipfs://${metaCid}/`);
    } catch (e) {
      setStage('idle');
      toast(errorMessage(e, t), 'error');
    }
  }

  const list = (xs: (number | string)[]) => `${xs.slice(0, 8).map((x) => (typeof x === 'number' ? `#${x}` : x)).join(', ')}${xs.length > 8 ? ` … (+${xs.length - 8})` : ''}`;
  return (
    <div className="card card--pad" style={{ display: 'grid', gap: 14 }}>
      <div className="grid-2">
        <button type="button" className="upload" style={{ minHeight: 96 }} onClick={() => imgRef.current?.click()} disabled={stage === 'images' || stage === 'json'}>
          <span className="strong">{t('art.imagesFolder')}</span>
          <span className="small muted">{images.length ? t('art.files', { n: images.length }) : '…'}</span>
          <input ref={imgRef} type="file" hidden multiple accept="image/*,video/mp4,video/webm,video/quicktime" {...dirProps} onChange={(e) => { setImages([...(e.target.files || [])].filter((f) => !f.name.startsWith('.'))); setStage('idle'); }} />
        </button>
        <button type="button" className="upload" style={{ minHeight: 96 }} onClick={() => jsonRef.current?.click()} disabled={stage === 'images' || stage === 'json'}>
          <span className="strong">{t('art.metadataFolder')}</span>
          <span className="small muted">{meta.length ? t('art.files', { n: meta.length }) : '…'}</span>
          <input ref={jsonRef} type="file" hidden multiple {...dirProps} onChange={(e) => { setMeta([...(e.target.files || [])].filter((f) => /\.json$/i.test(f.name) || /^\d+$/.test(f.name))); setStage('idle'); }} />
        </button>
      </div>

      {reading && <div className="small muted row" style={{ gap: 8 }}><span className="spinner" style={{ width: 13, height: 13 }} />{t('up.reading')}</div>}
      {plan && !reading && (
        <div className="mcheck mcheck--flat">
          {plan.badNames.length > 0 && <UpRow level="warn" title={t('up.badNames', { n: plan.badNames.length })} body={list(plan.badNames)} />}
          {plan.invalid.length > 0 && <UpRow level="error" title={t('up.invalid', { n: plan.invalid.length })} body={list(plan.invalid)} />}
          {plan.dups.length > 0 && <UpRow level="error" title={t('up.dups')} body={list(plan.dups)} />}
          {plan.missing.length > 0
            ? <UpRow level="error" title={t('up.missing', { n: plan.missing.length })} body={list(plan.missing)} />
            : count > 0 && <UpRow level="ok" title={t('up.files', { n: count })} />}
          {plan.shift > 0 && <UpRow level="info" title={t('up.shift', { max: count, last: count - 1 })} />}
          {expected && count > 0 && count !== expected && <UpRow level="warn" title={t('art.warnCount', { n: count, max: expected })} />}
          {images.length > 0 && (plan.unmatched.length
            ? <UpRow level="error" title={t('up.unmatched', { n: plan.unmatched.length })} body={t('up.unmatchedBody', { ids: list(plan.unmatched) })} />
            : <UpRow level="ok" title={t('up.matched', { n: plan.images.size })} />)}
          {!images.length && plan.placeholder && <UpRow level="error" title={t('up.placeholder')} />}
          {!images.length && !plan.placeholder && count > 0 && <UpRow level="info" title={t('up.noImages')} />}
        </div>
      )}

      {(stage === 'images' || stage === 'json') && (
        <div>
          <Progress value={pct} max={100} />
          <div className="progress-meta"><span>{t(stage === 'images' ? 'art.uploadingImages' : 'art.uploadingJson', { pct })}</span></div>
        </div>
      )}
      {stage === 'done' ? (
        <div className="row strong"><IconCheck size={16} />{t('art.done')}</div>
      ) : (
        <button type="button" className="btn" disabled={blocking || reading || stage !== 'idle'} onClick={start}>
          {uploaded.current?.key === imagesKey && images.length ? t('up.retryMeta') : t('art.upload')}
        </button>
      )}
    </div>
  );
}

function UpRow({ level, title, body }: { level: 'ok' | 'error' | 'warn' | 'info'; title: string; body?: string }) {
  return (
    <div className={`mcheck__row is-${level}`}>
      <span className="mcheck__icon">{level === 'ok' ? <IconCheck size={14} /> : level === 'error' ? <IconClose size={13} /> : <IconAlert size={14} />}</span>
      <div style={{ minWidth: 0 }}>
        <div className="mcheck__title">{title}</div>
        {body && <div className="mcheck__body">{body}</div>}
      </div>
    </div>
  );
}

export function PreRevealUpload({ name, onDone }: { name: string; onDone: (uri: string, image: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const authed = useAuthedApi();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      setPreview(URL.createObjectURL(file));
      const res = await authed.upload<{ uri: string; image: string }>('/uploads/prereveal', file, { name: `${name || 'Collection'} (unrevealed)` });
      onDone(res.uri, res.image);
    } catch (e) {
      setPreview(null);
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload upload--square" style={{ width: 200 }} onClick={() => ref.current?.click()} role="button" tabIndex={0}>
      {preview && <img src={preview} alt="" />}
      <span className="btn btn--sm btn--outline" style={{ background: 'var(--bg)' }}>{busy ? <><span className="spinner" />{t('create.uploading')}</> : t('art.pickImage')}</span>
      <input ref={ref} type="file" hidden accept={IMAGE_ACCEPT} onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/** Reads addresses from a CSV/TXT file (any column, any separator). */
export async function readAddressFile(file: File): Promise<string[]> {
  const text = await file.text();
  return [...new Set((text.match(/0x[0-9a-fA-F]{40}/g) || []).map((a) => a.toLowerCase()))];
}
