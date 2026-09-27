// Create page building blocks: image-link fields with a live preview and size check, the pre-reveal picker
// (image link or metadata link), and the metadata check for https / ar folders.
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { IconAlert, IconCheck } from './Icons';
import { SmartImage, fixImageUrl } from './Art';

export const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7).replace(/^ipfs\//, '')}` : u.startsWith('ar://') ? `https://arweave.net/${u.slice(5)}` : u);
export const isImageLink = (u: string) => /^(https:\/\/|ipfs:\/\/|ar:\/\/)\S+$/i.test(u.trim());

/** Every image type browsers display: PNG, JPG, GIF, WebP, AVIF, SVG, BMP. */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml,image/bmp,.png,.jpg,.jpeg,.gif,.webp,.avif,.svg,.bmp';

/** The URL the browser loads for a link: ar:// through arweave.net, IPFS through the preferred gateway. */
export const previewUrl = (link: string, gateway?: string | null) => (link.startsWith('ar://') ? toHttp(link) : fixImageUrl(toHttp(link), gateway));

type Probe = { state: 'idle' | 'format' | 'loading' | 'ok' | 'bad'; w: number; h: number };

/** Loads a pasted image link (after a short pause in typing) to check it opens and to read its size. */
export function useImageProbe(link: string): Probe & { src: string } {
  const { ipfsGateway } = useAppConfig();
  const v = link.trim();
  const src = v && isImageLink(v) ? previewUrl(v, ipfsGateway) : '';
  const [p, setP] = useState<Probe>({ state: 'idle', w: 0, h: 0 });
  useEffect(() => {
    if (!v) return setP({ state: 'idle', w: 0, h: 0 });
    if (!src) return setP({ state: 'format', w: 0, h: 0 });
    setP({ state: 'loading', w: 0, h: 0 });
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setP({ state: 'ok', w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => alive && setP({ state: 'bad', w: 0, h: 0 });
    const start = window.setTimeout(() => { img.src = src; }, 350);
    const giveUp = window.setTimeout(() => alive && setP((s) => (s.state === 'loading' ? { state: 'bad', w: 0, h: 0 } : s)), 20_000);
    return () => { alive = false; window.clearTimeout(start); window.clearTimeout(giveUp); img.onload = null; img.onerror = null; };
  }, [v, src]);
  return { ...p, src };
}

function SizeInfo({ w, h, want }: { w: number; h: number; want: { w: number; h: number } }) {
  const { t } = useI18n();
  if (!w || !h) return null; // SVGs without a set size
  const warns: string[] = [];
  if (Math.abs(w / h - want.w / want.h) > 0.08) warns.push(t('img.warnRatio', { r: want.w === want.h ? '1:1' : `${want.w}:${want.h}`.replace('1500:500', '3:1') }));
  if (w < want.w * 0.66 || h < want.h * 0.66) warns.push(t('img.warnSmall'));
  return (
    <div className="img-info">
      <span className="img-info__ok"><IconCheck size={13} />{t('img.loaded')}</span>
      <span className="mono-num">{w} × {h} px</span>
      {warns.map((x) => <span key={x} className="img-info__warn"><IconAlert size={13} />{x}</span>)}
    </div>
  );
}

const IconPicture = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" />
  </svg>
);

function ProbeHint({ p }: { p: Probe }) {
  const { t } = useI18n();
  if (p.state === 'format') return <span className="hint hint--bad">{t('img.linkFormat')}</span>;
  if (p.state === 'bad') return <span className="hint hint--bad">{t('img.linkBad')}</span>;
  if (p.state === 'loading') return <span className="hint">{t('img.linkLoading')}</span>;
  return null;
}

/** Logo / banner from a hosted link (https://, ipfs:// or ar://). Nothing is uploaded to STABLE. */
export function ImageField({ label, required, spec, value, onChange, square }: {
  label: string; required?: boolean; spec: { w: number; h: number }; value: string | null; onChange: (url: string | null) => void; square?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const [link, setLink] = useState(value || '');
  const p = useImageProbe(link);
  const accepted = p.state === 'ok' ? link.trim() : null;
  useEffect(() => { if (accepted !== value) onChange(accepted); }, [accepted]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="field link-image">
      <label className="label" htmlFor={id}>{label}{required && <span className="req">*</span>}</label>
      <div className={`link-image__box ${square ? 'is-square' : 'is-wide'} is-${p.state}`}>
        {p.state === 'ok' ? <img src={p.src} alt="" /> : (
          <span className="link-image__empty">
            {p.state === 'loading' ? <span className="spinner" /> : <IconPicture />}
            <span className="tiny">{square ? '1:1' : '3:1'} · {spec.w} × {spec.h}</span>
          </span>
        )}
      </div>
      <input id={id} className="input" value={link} onChange={(e) => setLink(e.target.value.trim())} placeholder="https://…  ·  ipfs://…" spellCheck={false} inputMode="url" autoComplete="off" />
      <ProbeHint p={p} />
      {p.state === 'ok' ? <SizeInfo w={p.w} h={p.h} want={spec} /> : p.state === 'idle' && <span className="hint">{t('img.linkSpec', { w: spec.w, h: spec.h })}</span>}
    </div>
  );
}

/** Pre-reveal: an image link (STABLE writes the placeholder metadata on-chain) or a link to your own metadata JSON. */
export function PreRevealPicker({ name, description, value, onChange }: { name: string; description: string; value: string; onChange: (uri: string) => void }) {
  const { t } = useI18n();
  const { ipfsGateway } = useAppConfig();
  const [mode, setMode] = useState<'image' | 'meta'>(value && !value.startsWith('data:') ? 'meta' : 'image');
  const [imageLink, setImageLink] = useState(() => {
    if (!value.startsWith('data:application/json;base64,')) return '';
    try { return String(JSON.parse(decodeURIComponent(escape(atob(value.split(',')[1])))).image || ''); } catch { return ''; }
  });
  const [metaLink, setMetaLink] = useState(value.startsWith('data:') ? '' : value);
  const [metaPreview, setMetaPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; msg: string } | null>(null);
  const p = useImageProbe(mode === 'image' ? imageLink : '');
  const meta = (image: string) => `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify({ name: `${name || 'Collection'} (unrevealed)`, description, image }))))}`;

  // Image mode: the placeholder is ready as soon as the image opens (and follows later name / description edits).
  useEffect(() => {
    if (mode !== 'image') return;
    onChange(p.state === 'ok' ? meta(imageLink.trim()) : '');
  }, [mode, p.state, imageLink, name, description]); // eslint-disable-line react-hooks/exhaustive-deps

  async function useMetaLink() {
    setBusy(true);
    setCheck(null);
    setMetaPreview(null);
    onChange('');
    try {
      const r = await api.get<{ items: { ok: boolean; name?: string; image?: string; error?: string }[] }>('/share/metadata', { uri: metaLink });
      const it = r.items[0];
      if (!it?.ok) throw new Error(it?.error || t('img.linkBad'));
      if (!it.image) throw new Error(t('img.noImageField'));
      setMetaPreview(it.image);
      setCheck({ ok: true, msg: it.name || 'OK' });
      onChange(metaLink);
    } catch (e: any) {
      setCheck({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  const preview = mode === 'image' ? (p.state === 'ok' ? p.src : null) : metaPreview ? previewUrl(metaPreview, ipfsGateway) : null;
  return (
    <div className="prereveal-card">
      <div className="segmented prereveal-card__tabs" role="tablist" aria-label={t('art.prereveal')}>
        {(['image', 'meta'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} aria-pressed={mode === m} onClick={() => { setMode(m); setCheck(null); if (m === 'meta' && !metaPreview) onChange(''); }}>{t(`img.mode.${m}`)}</button>
        ))}
      </div>
      <div className="prereveal">
        <div className={`prereveal__preview${preview ? ' has-image' : ''}`}>
          {preview ? <img src={preview} alt="" /> : busy || p.state === 'loading' ? <span className="spinner" /> : <span className="muted small"><IconPicture /><br />{t('img.previewHere')}</span>}
        </div>
        <div className="prereveal__form">
          {mode === 'image' ? (
            <>
              <label className="label" htmlFor="pre-img">{t('img.mode.image')}</label>
              <input id="pre-img" className="input" placeholder="https://…  ·  ipfs://…" value={imageLink} onChange={(e) => setImageLink(e.target.value.trim())} spellCheck={false} inputMode="url" autoComplete="off" />
              <ProbeHint p={p} />
              {p.state === 'idle' && <span className="hint">{t('img.imageLinkHint')}</span>}
              {p.state === 'ok' && <SizeInfo w={p.w} h={p.h} want={{ w: 1000, h: 1000 }} />}
            </>
          ) : (
            <>
              <label className="label" htmlFor="pre-meta">{t('img.mode.meta')}</label>
              <input id="pre-meta" className="input" placeholder="ipfs://…/hidden.json" value={metaLink} onChange={(e) => { setMetaLink(e.target.value.trim()); setCheck(null); setMetaPreview(null); onChange(''); }} spellCheck={false} inputMode="url" autoComplete="off" />
              <span className="hint">{t('img.metaLinkHint')}</span>
              <button type="button" className="btn btn--outline btn--sm" style={{ justifySelf: 'start' }} disabled={!isImageLink(metaLink) || busy} onClick={useMetaLink}>{busy && <span className="spinner" />}{t('img.checkUse')}</button>
              {check && !check.ok && <div className="notice notice--strong small"><IconAlert size={14} />{check.msg}</div>}
            </>
          )}
          {value && !busy && <div className="prereveal__ready"><IconCheck size={15} />{t('img.ready')}</div>}
        </div>
      </div>
    </div>
  );
}

type CheckItem = {
  id: string; ok: boolean; name?: string | null; image?: string | null; attributes?: { trait_type: string; value: unknown }[]; error?: string; hasImage?: boolean;
  rawImage?: string | null; imageIssue?: 'raw_cid_path' | null; imageOk?: boolean; imageError?: string | null;
};

/** For https:// and ar:// folders: reads 1.json, 2.json, 3.json and the last one, as the contract will. (IPFS folders use MetadataCheck.) */
export function LegacyMetadataCheck({ baseUri, onResult, expected }: { baseUri: string; onResult: (ok: boolean) => void; expected?: number }) {
  const { t } = useI18n();
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = useRef('');

  async function run() {
    const base = baseUri.trim();
    setErr(null);
    setItems(null);
    setWarnings([]);
    onResult(false);
    if (!/^(ipfs:\/\/|https:\/\/|ar:\/\/)/.test(base)) return setErr(t('create.errUri'));
    if (!base.endsWith('/')) return setErr(t('meta.slash'));
    setBusy(true);
    last.current = base;
    try {
      // Tokens 1–3 plus the last token (supply), so a folder that is one file short is caught before launch.
      const last = expected && expected > 3 ? expected : null;
      const r = await api.get<{ items: CheckItem[] }>('/share/metadata', { base, ids: ['1', '2', '3', ...(last ? [String(last)] : [])].join(',') });
      setItems(r.items.filter((it) => !last || it.id !== String(last) || !it.ok));
      const w: string[] = [];
      const good = r.items.filter((it) => it.ok);
      const lastItem = last ? r.items.find((it) => it.id === String(last)) : null;
      if (lastItem && !lastItem.ok) w.push(t('meta.lastMissing', { n: last! }));
      if (good.some((it) => it.imageIssue === 'raw_cid_path')) {
        const ex = good.find((it) => it.imageIssue)?.rawImage || '';
        w.push(t('meta.rawCid', { example: ex.length > 70 ? `${ex.slice(0, 40)}…${ex.slice(-22)}` : ex }));
      } else {
        const broken = good.filter((it) => it.hasImage && it.imageOk === false);
        if (broken.length) w.push(t('meta.imageBroken', { ids: broken.map((b) => `#${b.id}`).join(', '), error: broken[0].imageError || '' }));
      }
      setWarnings(w);
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
      {warnings.map((w) => <div key={w} className="notice notice--warn small"><IconAlert size={14} /><span>{w}</span></div>)}
      {items && (
        <div className="meta-check">
          {items.map((it) => (
            <div key={it.id} className={`meta-check__item ${it.ok ? '' : 'is-bad'}`}>
              <div className="meta-check__img" style={{ position: 'relative' }}>{it.image ? <SmartImage src={it.image} alt="" fallback={<IconAlert size={18} />} /> : <IconAlert size={18} />}</div>
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
