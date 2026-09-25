// Create page building blocks: image fields with size/format guidance, pre-reveal options, and a metadata check.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { useAuthedApi } from '../lib/tx';
import { errorMessage } from '../lib/actions';
import { IconAlert, IconCheck } from './Icons';
import { useToast } from './ui';

const MB = 1024 * 1024;
export const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7).replace(/^ipfs\//, '')}` : u.startsWith('ar://') ? `https://arweave.net/${u.slice(5)}` : u);
const isImageLink = (u: string) => /^(https:\/\/|ipfs:\/\/|ar:\/\/)\S+$/i.test(u.trim());

type Info = { w: number; h: number; mb: number; format: string };
async function readInfo(file: File): Promise<Info> {
  const bmp = await createImageBitmap(file);
  const info = { w: bmp.width, h: bmp.height, mb: file.size / MB, format: (file.type.split('/')[1] || '?').toUpperCase().replace('JPEG', 'JPG') };
  bmp.close();
  return info;
}

/** Resizes to maxDim and re-encodes to WebP until it fits maxBytes (GIFs are kept as-is to stay animated). */
async function fitImage(file: File, maxDim: number, maxBytes: number): Promise<File> {
  if (file.type === 'image/gif') {
    if (file.size > maxBytes) throw new Error(`GIF is ${(file.size / MB).toFixed(1)} MB; the limit here is ${(maxBytes / MB).toFixed(0)} MB. Use a smaller GIF or paste a link.`);
    return file;
  }
  const bmp = await createImageBitmap(file);
  if (file.size <= maxBytes && Math.max(bmp.width, bmp.height) <= maxDim) { bmp.close(); return file; }
  let dim = Math.min(maxDim, Math.max(bmp.width, bmp.height));
  for (let q = 0.92; ; q -= 0.08) {
    const scale = dim / Math.max(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/webp', q));
    if (blob.size <= maxBytes || q < 0.5) {
      bmp.close();
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
    }
    if (q < 0.6) dim = Math.round(dim * 0.8);
  }
}

function InfoLine({ info, want }: { info: Info; want: { w: number; h: number } }) {
  const { t } = useI18n();
  const ratio = info.w / info.h;
  const wantRatio = want.w / want.h;
  const warns: string[] = [];
  if (Math.abs(ratio - wantRatio) > 0.08) warns.push(t('img.warnRatio', { r: want.w === want.h ? '1:1' : `${want.w}:${want.h}`.replace('1500:500', '3:1') }));
  if (info.w < want.w * 0.66 || info.h < want.h * 0.66) warns.push(t('img.warnSmall'));
  return (
    <div className="img-info">
      <span className="mono-num">{info.w} × {info.h} px</span><span>{info.format}</span><span className="mono-num">{info.mb.toFixed(2)} MB</span>
      {warns.map((w) => <span key={w} className="img-info__warn"><IconAlert size={13} />{w}</span>)}
    </div>
  );
}

/** Logo / banner: upload (with size guidance and auto-resize) or paste a hosted link. */
export function ImageField({ label, required, spec, value, onChange, square, maxDim }: {
  label: string; required?: boolean; spec: { w: number; h: number }; value: string | null; onChange: (url: string | null) => void; square?: boolean; maxDim: number;
}) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const authed = useAuthedApi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [link, setLink] = useState('');
  const limit = cfg.ipfsUploads ? 8 : 2;

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      setInfo(await readInfo(file));
      const fitted = await fitImage(file, maxDim, (limit - 0.1) * MB);
      const res = await authed.upload<{ url: string }>('/uploads', fitted);
      onChange(res.url);
    } catch (e) {
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="field">
      <span className="label">{label}{required && <span className="req">*</span>}</span>
      <div className={`upload ${square ? 'upload--square' : 'upload--banner'}`} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}>
        {value && <img src={toHttp(value)} alt="" />}
        <span className="btn btn--sm btn--outline" style={{ background: 'var(--bg)' }}>
          {busy ? <><span className="spinner" />{t('create.uploading')}</> : value ? t('create.change') : t('create.upload')}
        </span>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <span className="hint">{t('img.spec', { w: spec.w, h: spec.h, mb: limit })}</span>
      {info && <InfoLine info={info} want={spec} />}
      <div className="row" style={{ gap: 6 }}>
        <input className="input input--sm" placeholder={t('img.orLink')} value={link} onChange={(e) => setLink(e.target.value.trim())} />
        <button type="button" className="btn btn--sm btn--outline" disabled={!isImageLink(link)} onClick={() => { onChange(link); setInfo(null); }}>{t('img.useLink')}</button>
      </div>
    </div>
  );
}

/** Pre-reveal: upload an image, paste an image link, or paste an existing metadata link. */
export function PreRevealPicker({ name, description, value, onChange }: { name: string; description: string; value: string; onChange: (uri: string) => void }) {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const authed = useAuthedApi();
  const [mode, setMode] = useState<'upload' | 'image' | 'meta'>('upload');
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [check, setCheck] = useState<{ ok: boolean; msg: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const limit = cfg.ipfsUploads ? 8 : 2;
  const meta = (image: string) => `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify({ name: `${name || 'Collection'} (unrevealed)`, description, image }))))}`;

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      setInfo(await readInfo(file));
      setPreview(URL.createObjectURL(file));
      const fitted = await fitImage(file, 2000, (limit - 0.1) * MB);
      const res = await authed.upload<{ uri: string; image: string }>('/uploads/prereveal', fitted, { name: `${name || 'Collection'} (unrevealed)` });
      onChange(res.uri);
    } catch (e) {
      setPreview(null);
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function useMetaLink() {
    setBusy(true);
    setCheck(null);
    try {
      const r = await api.get<{ items: { ok: boolean; name?: string; image?: string; error?: string }[] }>('/share/metadata', { uri: link });
      const it = r.items[0];
      if (!it.ok) throw new Error(it.error || 'Not reachable');
      if (!it.image) throw new Error(t('img.noImageField'));
      setPreview(it.image);
      setCheck({ ok: true, msg: it.name || 'OK' });
      onChange(link);
    } catch (e: any) {
      setCheck({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card--pad" style={{ display: 'grid', gap: 14 }}>
      <div className="segmented" role="tablist" style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
        {(['upload', 'image', 'meta'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setCheck(null); }}>{t(`img.mode.${m}`)}</button>
        ))}
      </div>
      <div className="prereveal">
        <div className="prereveal__preview">{preview || (value && !value.startsWith('data:')) ? <img src={preview || toHttp(value)} alt="" /> : <span className="muted small">{t('img.previewHere')}</span>}</div>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
          {mode === 'upload' && (
            <>
              <button type="button" className="btn btn--outline" onClick={() => input.current?.click()} disabled={busy}>{busy ? <><span className="spinner" />{t('create.uploading')}</> : t('art.pickImage')}</button>
              <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
              <span className="hint">{t('img.specPre', { mb: limit })}</span>
              {info && <InfoLine info={info} want={{ w: 1000, h: 1000 }} />}
            </>
          )}
          {mode === 'image' && (
            <>
              <input className="input" placeholder="https://… or ipfs://…" value={link} onChange={(e) => setLink(e.target.value.trim())} />
              <span className="hint">{t('img.imageLinkHint')}</span>
              <button type="button" className="btn btn--outline" disabled={!isImageLink(link)} onClick={() => { setPreview(toHttp(link)); onChange(meta(link)); }}>{t('img.useLink')}</button>
            </>
          )}
          {mode === 'meta' && (
            <>
              <input className="input" placeholder="ipfs://…/hidden.json" value={link} onChange={(e) => setLink(e.target.value.trim())} />
              <span className="hint">{t('img.metaLinkHint')}</span>
              <button type="button" className="btn btn--outline" disabled={!isImageLink(link) || busy} onClick={useMetaLink}>{busy && <span className="spinner" />}{t('img.checkUse')}</button>
            </>
          )}
          {value && !busy && <div className="row small strong" style={{ gap: 6 }}><IconCheck size={15} />{t('img.ready')}</div>}
          {check && !check.ok && <div className="notice notice--strong small"><IconAlert size={14} />{check.msg}</div>}
        </div>
      </div>
    </div>
  );
}

type CheckItem = { id: string; ok: boolean; name?: string | null; image?: string | null; attributes?: { trait_type: string; value: unknown }[]; error?: string; hasImage?: boolean };

/** Reads 1.json, 2.json, 3.json from the base URI exactly as the contract will, and shows what collectors will see. */
export function MetadataCheck({ baseUri, onResult }: { baseUri: string; onResult: (ok: boolean) => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = useRef('');

  async function run() {
    const base = baseUri.trim();
    setErr(null);
    setItems(null);
    onResult(false);
    if (!/^(ipfs:\/\/|https:\/\/|ar:\/\/)/.test(base)) return setErr(t('create.errUri'));
    if (!base.endsWith('/')) return setErr(t('meta.slash'));
    setBusy(true);
    last.current = base;
    try {
      const r = await api.get<{ items: CheckItem[] }>('/share/metadata', { base, ids: '1,2,3' });
      setItems(r.items);
      const first = r.items[0];
      if (!first?.ok) {
        const alt = await api.get<{ items: CheckItem[] }>('/share/metadata', { uri: `${base}1` }).catch(() => null);
        setErr(alt?.items[0]?.ok ? t('meta.noExt') : t('meta.missing'));
      } else if (!first.hasImage) setErr(t('img.noImageField'));
      onResult(Boolean(first?.ok && first.hasImage));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (baseUri && baseUri !== last.current && /\/$/.test(baseUri) && /^(ipfs|https|ar):\/\//.test(baseUri)) run();
  }, [baseUri]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <button type="button" className="btn btn--outline btn--sm" style={{ justifySelf: 'start' }} onClick={run} disabled={busy || !baseUri}>{busy && <span className="spinner" />}{t('meta.check')}</button>
      {err && <div className="notice notice--strong small"><IconAlert size={14} />{err}</div>}
      {items && (
        <div className="meta-check">
          {items.map((it) => (
            <div key={it.id} className={`meta-check__item ${it.ok ? '' : 'is-bad'}`}>
              <div className="meta-check__img">{it.image ? <img src={it.image} alt="" loading="lazy" /> : <IconAlert size={18} />}</div>
              <div style={{ minWidth: 0 }}>
                <div className="strong small ellipsis">{it.ok ? it.name || `#${it.id}` : `${it.id}.json`}</div>
                <div className="tiny muted">{it.ok ? t('meta.traits', { n: it.attributes?.length ?? 0 }) : it.error}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
