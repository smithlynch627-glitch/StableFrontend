// IPFS uploads for creators.
// - Folder upload: images folder + metadata folder (1.json, 2.json, ...). The browser uploads straight to IPFS
//   (Pinata) with a single-use, upload-only key from our API, so the platform's Pinata secret never reaches the browser.
// - Pre-reveal: one image → placeholder metadata (IPFS, or hosted by the API when IPFS is not configured).
import { useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useAppConfig } from '../lib/appConfig';
import { useAuthedApi } from '../lib/tx';
import { errorMessage } from '../lib/actions';
import { IconCheck } from './Icons';
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

export function IpfsFolderUpload({ expected, onDone }: { expected?: number; onDone: (baseUri: string) => void }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const authed = useAuthedApi();
  const [images, setImages] = useState<File[]>([]);
  const [meta, setMeta] = useState<File[]>([]);
  const [stage, setStage] = useState<'idle' | 'images' | 'json' | 'done'>('idle');
  const [pct, setPct] = useState(0);
  const [warn, setWarn] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const dirProps = { webkitdirectory: '', directory: '' } as any;

  if (!cfg.ipfsUploads) return <p className="notice">{t('art.noIpfs')}</p>;

  async function start() {
    setWarn(null);
    try {
      // Parse and validate metadata before spending any upload.
      const entries: { id: number; data: any }[] = [];
      for (const f of meta) {
        const id = Number(stem(f.name));
        if (!Number.isInteger(id) || id < 0) throw new Error(t('art.errIds'));
        try {
          entries.push({ id, data: JSON.parse(await f.text()) });
        } catch {
          throw new Error(t('art.errJson', { name: f.name }));
        }
      }
      if (!entries.length) throw new Error(t('art.errIds'));
      if (expected && entries.length !== expected) setWarn(t('art.warnCount', { n: entries.length, max: expected }));

      let imageCid = '';
      if (images.length) {
        setStage('images');
        const k1 = await authed.post<{ jwt: string; endpoint: string }>('/uploads/ipfs-key');
        imageCid = await uploadFolder(images.map((f) => ({ file: f, path: `images/${baseName(f.name)}` })), k1.jwt, k1.endpoint, setPct);
      }
      const byName = new Map(images.map((f) => [baseName(f.name), baseName(f.name)]));
      const byStem = new Map(images.map((f) => [stem(f.name), baseName(f.name)]));
      const out = entries.map(({ id, data }) => {
        const ref = typeof data.image === 'string' ? baseName(data.image) : '';
        const file = byName.get(ref) || byStem.get(String(id));
        if (imageCid && file) data.image = `ipfs://${imageCid}/${file}`;
        return { file: new Blob([JSON.stringify(data)], { type: 'application/json' }), path: `metadata/${id}.json` };
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

  return (
    <div className="card card--pad" style={{ display: 'grid', gap: 14 }}>
      <div className="grid-2">
        <button type="button" className="upload" style={{ minHeight: 96 }} onClick={() => imgRef.current?.click()}>
          <span className="strong">{t('art.imagesFolder')}</span>
          <span className="small muted">{images.length ? t('art.files', { n: images.length }) : '…'}</span>
          <input ref={imgRef} type="file" hidden multiple accept="image/*,video/mp4" {...dirProps} onChange={(e) => setImages([...(e.target.files || [])].filter((f) => !f.name.startsWith('.')))} />
        </button>
        <button type="button" className="upload" style={{ minHeight: 96 }} onClick={() => jsonRef.current?.click()}>
          <span className="strong">{t('art.metadataFolder')}</span>
          <span className="small muted">{meta.length ? t('art.files', { n: meta.length }) : '…'}</span>
          <input ref={jsonRef} type="file" hidden multiple {...dirProps} onChange={(e) => setMeta([...(e.target.files || [])].filter((f) => /\.json$/i.test(f.name) || /^\d+$/.test(f.name)))} />
        </button>
      </div>
      {warn && <div className="notice">{warn}</div>}
      {(stage === 'images' || stage === 'json') && (
        <div>
          <Progress value={pct} max={100} />
          <div className="progress-meta"><span>{t(stage === 'images' ? 'art.uploadingImages' : 'art.uploadingJson', { pct })}</span></div>
        </div>
      )}
      {stage === 'done' ? (
        <div className="row strong"><IconCheck size={16} />{t('art.done')}</div>
      ) : (
        <button type="button" className="btn" disabled={!meta.length || stage !== 'idle'} onClick={start}>{t('art.upload')}</button>
      )}
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
      <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/** Reads addresses from a CSV/TXT file (any column, any separator). */
export async function readAddressFile(file: File): Promise<string[]> {
  const text = await file.text();
  return [...new Set((text.match(/0x[0-9a-fA-F]{40}/g) || []).map((a) => a.toLowerCase()))];
}
