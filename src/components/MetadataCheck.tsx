// Checks a metadata folder before launch or reveal, the way the contract will read it (base + id + ".json"),
// and explains every problem in plain words with how to fix it.
// IPFS folders get the full check: folder listing, every token file, and the images folder. A fresh upload
// that IPFS has not spread yet is waited for automatically instead of showing errors.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { api } from '../lib/api';
import { SmartImage } from './Art';
import { LegacyMetadataCheck } from './CreateArt';
import { IconAlert, IconCheck, IconClose, IconInfo } from './Icons';

type Level = 'error' | 'warn' | 'info';
type Problem = { code: string; level: Level; count?: number; sample?: number[]; supply?: number; base?: string; example?: string | null; detail?: string; id?: string; value?: string };
type Sample = { id: string; file: string; ok: boolean; name?: string | null; image?: string | null; rawImage?: string | null; attributes?: number; imageOk?: boolean | null; imageError?: string | null; placeholder?: boolean; error?: string };
type Inspect = { stage: 'found' | 'pending' | 'bad'; cid?: string; files?: number; tokenFiles?: number; minId?: number; maxId?: number; listing?: boolean; problems?: Problem[]; samples?: Sample[]; detail?: string };
type Validate = {
  stage: 'found' | 'pending' | 'bad'; ok?: boolean; checked?: number; invalid?: number[]; unreadable?: { id: number; error: string }[]; noImage?: number[];
  placeholder?: { count: number; example: string | null }; rawCidPath?: number; error?: string;
  images?: { folders: number; referenced: number; found: number; missing: { id: number; file: string }[]; missingCount?: number; hint?: { wrote: string; actual: string } | null; pending?: boolean; separate?: boolean } | null;
};

export const isIpfsBase = (u: string) => /^(ipfs:\/\/(ipfs\/)?|https?:\/\/[^/]+\/ipfs\/)[a-zA-Z0-9]{40,}/.test(u.trim());
const WAITS = [4, 6, 8, 10, 12, 15, 15, 20]; // seconds between tries while IPFS spreads a new upload (~1.5 min)

export function MetadataCheck(props: { baseUri: string; onResult: (ok: boolean) => void; expected?: number; onFix?: (base: string) => void }) {
  if (props.baseUri.trim() && !isIpfsBase(props.baseUri)) return <LegacyMetadataCheck baseUri={props.baseUri} onResult={props.onResult} expected={props.expected} />;
  return <IpfsFolderCheck {...props} />;
}

function IpfsFolderCheck({ baseUri, onResult, expected, onFix }: { baseUri: string; onResult: (ok: boolean) => void; expected?: number; onFix?: (base: string) => void }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<'idle' | 'finding' | 'waiting' | 'reading' | 'done' | 'failed'>('idle');
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [full, setFull] = useState<Validate | null>(null);
  const [tries, setTries] = useState(0);
  const [wait, setWait] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [overridden, setOverridden] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (phase !== 'finding') return setSlow(false);
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, [phase]);
  const run = useRef(0);
  const base = baseUri.trim();
  const supply = expected || 0;

  async function check(attempt = 0) {
    const id = ++run.current;
    const alive = () => id === run.current;
    setErr(null);
    setOverridden(false);
    onResult(false);
    if (!base) return setPhase('idle');
    if (!base.endsWith('/')) {
      setPhase('done');
      setInspect(null);
      return setErr(t('meta.slash'));
    }
    setPhase(attempt ? 'waiting' : 'finding');
    setTries(attempt);
    if (!attempt) { setInspect(null); setFull(null); }
    let r: Inspect;
    try {
      r = await api.get<Inspect>('/share/ipfs/inspect', { base, supply });
    } catch (e: any) {
      if (!alive()) return;
      setPhase('failed');
      return setErr(e.message);
    }
    if (!alive()) return;
    if (r.stage === 'pending') {
      setInspect(r);
      if (attempt >= WAITS.length) return setPhase('failed');
      setPhase('waiting');
      let left = WAITS[attempt];
      setWait(left);
      const tick = setInterval(() => {
        if (!alive()) return clearInterval(tick);
        left -= 1;
        setWait(left);
        if (left <= 0) {
          clearInterval(tick);
          check(attempt + 1);
        }
      }, 1000);
      return;
    }
    setInspect(r);
    const blocking = (r.problems || []).some((p) => p.level === 'error') || r.stage === 'bad' || !r.samples?.[0]?.ok;
    if (blocking || r.listing === false) {
      setPhase('done');
      onResult(!blocking);
      return;
    }
    // Readable: now every file and the images folder.
    setPhase('reading');
    onResult(true); // good enough to continue; the full check below can still flag problems
    try {
      const v = await api.get<Validate>('/share/ipfs/validate', { base, supply });
      if (!alive()) return;
      setFull(v);
      onResult(v.stage !== 'found' || v.ok !== false);
    } catch {
      if (alive()) setFull({ stage: 'pending' });
    }
    if (alive()) setPhase('done');
  }

  useEffect(() => {
    if (!base) {
      run.current += 1;
      setPhase('idle');
      setInspect(null);
      setFull(null);
      return;
    }
    const id = setTimeout(() => check(0), 500); // wait until the link is typed / pasted
    return () => clearTimeout(id);
  }, [base, supply]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { run.current += 1; }, []);

  const problems = inspect?.problems || [];
  const samples = inspect?.samples || [];
  const busy = phase === 'finding' || phase === 'reading';

  return (
    <div className="mcheck">
      <div className="mcheck__head">
        <span className="strong">{t('mc.title')}</span>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => check(0)} disabled={!base || busy}>
          {busy && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('mc.recheck')}
        </button>
      </div>

      {err && <Row level="error" title={err} />}

      {(phase === 'finding' || (phase === 'waiting' && !inspect)) && <Row level="busy" title={t('mc.finding')} body={slow ? t('mc.waitingBody') : undefined} />}
      {phase === 'waiting' && inspect?.stage === 'pending' && (
        <Row level="busy" title={t('mc.waiting')} body={<>{t('mc.waitingBody')} <span className="mono-num">{t('mc.retryIn', { s: wait, n: tries + 1, max: WAITS.length + 1 })}</span></>} />
      )}
      {phase === 'failed' && (
        <Row level="error" title={t('mc.notFound')} body={<>
          {t('mc.notFoundBody')}
          <div className="row-wrap" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn--sm" onClick={() => check(0)}>{t('mc.tryAgain')}</button>
            {!overridden && <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setOverridden(true); onResult(true); }}>{t('mc.continueAnyway')}</button>}
          </div>
          {overridden && <div className="tiny muted" style={{ marginTop: 6 }}>{t('mc.continued')}</div>}
        </>} />
      )}

      {inspect && inspect.stage !== 'pending' && (
        <>
          {inspect.stage === 'found' && inspect.files !== undefined && <Row level="ok" title={t('mc.folderFound', { n: inspect.files })} />}
          {inspect.stage === 'found' && inspect.listing === false && <Row level="ok" title={t('mc.firstFound')} />}
          {inspect.stage === 'found' && inspect.tokenFiles !== undefined && !problems.some((p) => p.code === 'missing' || p.code === 'zero_based') && inspect.tokenFiles > 0 && (
            <Row level="ok" title={supply ? t('mc.allPresent', { n: supply }) : t('mc.tokenFiles', { n: inspect.tokenFiles })} />
          )}
          {[...problems].sort((a, b) => rank(a) - rank(b)).map((p) => <ProblemRow key={p.code} p={p} supply={supply} onFix={onFix} />)}
        </>
      )}

      {phase === 'reading' && <Row level="busy" title={t('mc.reading')} />}
      {full && full.stage === 'found' && <FullRows v={full} />}
      {full && full.stage === 'pending' && phase === 'done' && <Row level="info" title={t('mc.fullLater')} />}

      {samples.length > 0 && (
        <div className="meta-check">
          {samples.map((s) => (
            <div key={s.id} className={`meta-check__item ${s.ok ? '' : 'is-bad'}`}>
              <div className="meta-check__img" style={{ position: 'relative' }}>
                {s.image && !s.placeholder ? <SmartImage src={s.image} alt="" fallback={<IconAlert size={18} />} /> : <IconAlert size={18} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="strong small ellipsis">{s.ok ? s.name || `#${s.id}` : s.file}</div>
                <div className="tiny muted ellipsis">{s.ok ? `${s.file} · ${t('meta.traits', { n: s.attributes ?? 0 })}` : s.error}</div>
                {s.ok && s.imageOk === false && <div className="tiny" style={{ color: 'var(--bad)' }}>{t('mc.imageNotLoading')}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ level, title, body }: { level: 'ok' | 'error' | 'warn' | 'info' | 'busy'; title: ReactNode; body?: ReactNode }) {
  const icon = level === 'ok' ? <IconCheck size={14} /> : level === 'error' ? <IconClose size={13} /> : level === 'busy' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : level === 'warn' ? <IconAlert size={14} /> : <IconInfo size={14} />;
  return (
    <div className={`mcheck__row is-${level}`}>
      <span className="mcheck__icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="mcheck__title">{title}</div>
        {body && <div className="mcheck__body">{body}</div>}
      </div>
    </div>
  );
}

// Folder-level problems first, then details (errors before warnings before notes).
const ORDER = ['bad_cid', 'path_missing', 'single_file', 'images_folder', 'use_subfolder', 'no_token_files', 'first_missing', 'missing', 'zero_based'];
const rank = (p: Problem) => (ORDER.includes(p.code) ? ORDER.indexOf(p.code) : 20 + (p.level === 'error' ? 0 : p.level === 'warn' ? 10 : 20));

const ids = (list: number[] | undefined, count?: number) => {
  const shown = (list || []).map((n) => `#${n}`).join(', ');
  return count && list && count > list.length ? `${shown} … (+${count - list.length})` : shown;
};

function ProblemRow({ p, supply, onFix }: { p: Problem; supply: number; onFix?: (base: string) => void }) {
  const { t } = useI18n();
  const level = p.level === 'error' ? 'error' : p.level === 'warn' ? 'warn' : 'info';
  const k = (s: string) => `mc.p.${s}` as DictKey;
  switch (p.code) {
    case 'missing':
      return <Row level={level} title={t(k('missing'), { n: p.count ?? 0, max: p.supply ?? supply })} body={<>{t(k('missingBody'))} <strong>{ids(p.sample, p.count)}</strong></>} />;
    case 'zero_based':
      return <Row level={level} title={t(k('zeroBased'))} body={t(k('zeroBasedBody'), { max: p.supply ?? supply, last: (p.supply ?? supply) - 1 })} />;
    case 'use_subfolder':
      return <Row level={level} title={t(k('useSubfolder'))} body={<>{t(k('useSubfolderBody'))}<code className="meta-inline" style={{ display: 'block', margin: '6px 0' }}>{p.base}</code>{onFix && p.base && <button type="button" className="btn btn--sm" onClick={() => onFix(p.base!)}>{t(k('useThis'))}</button>}</>} />;
    case 'placeholder':
      return <Row level={level} title={t(k('placeholder'))} body={<>{t(k('placeholderBody'))} <code className="meta-inline">{p.example}</code></>} />;
    case 'image_unreachable':
      return <Row level={level} title={t(k('imageUnreachable'))} body={<>{t(k('imageUnreachableBody'))} <code className="meta-inline">{p.example}</code>{p.detail ? ` (${p.detail})` : ''}</>} />;
    case 'unreadable':
      return <Row level={level} title={t(k('unreadable'), { id: p.id ?? '' })} body={p.detail} />;
    case 'no_ext':
    case 'mixed_ext':
      return <Row level={level} title={t(k('noExt'), { n: p.count ?? 0 })} body={t(k('noExtBody'))} />;
    case 'extra':
      return <Row level={level} title={t(k('extra'), { n: p.count ?? 0, max: p.supply ?? supply })} />;
    case 'has_zero':
      return <Row level={level} title={t(k('hasZero'))} />;
    case 'other_files':
      return <Row level={level} title={t(k('otherFiles'), { n: p.count ?? 0 })} body={p.example} />;
    case 'bad_cid':
      return <Row level={level} title={t(k('badCid'))} body={<code className="meta-inline">{p.value}</code>} />;
    default: {
      const map: Record<string, DictKey> = {
        path_missing: k('pathMissing'), single_file: k('singleFile'), images_folder: k('imagesFolder'), no_token_files: k('noTokenFiles'),
        first_missing: k('firstMissing'), no_image: k('noImage'),
      };
      const key = map[p.code];
      return <Row level={level} title={key ? t(key) : p.code} body={p.code === 'no_token_files' ? p.example : p.detail} />;
    }
  }
}

function FullRows({ v }: { v: Validate }) {
  const { t } = useI18n();
  const rows: ReactNode[] = [];
  const bad = (v.invalid?.length || 0) + (v.unreadable?.length || 0);
  if (v.unreadable?.length) rows.push(<Row key="u" level="error" title={t('mc.f.unreadable', { n: v.unreadable.length })} body={v.unreadable.map((x) => `#${x.id}: ${x.error}`).join(' · ')} />);
  if (v.invalid?.length) rows.push(<Row key="i" level="error" title={t('mc.f.invalid')} body={ids(v.invalid)} />);
  if (v.noImage?.length) rows.push(<Row key="n" level="error" title={t('mc.f.noImage')} body={ids(v.noImage)} />);
  if (v.placeholder?.count) rows.push(<Row key="p" level="error" title={t('mc.p.placeholder')} body={<>{t('mc.f.placeholderCount', { n: v.placeholder.count })} <code className="meta-inline">{v.placeholder.example}</code></>} />);
  if (!bad && !v.noImage?.length && !v.placeholder?.count) rows.push(<Row key="ok" level="ok" title={t('mc.f.allGood', { n: v.checked ?? 0 })} />);
  const im = v.images;
  if (im && !im.separate) {
    if (im.pending) rows.push(<Row key="ip" level="info" title={t('mc.f.imagesPending')} />);
    else if (im.missingCount) {
      rows.push(<Row key="im" level="error" title={t('mc.f.imagesMissing', { n: im.missingCount, total: im.referenced })}
        body={<>{t('mc.f.imagesMissingBody')} <strong>{im.missing.slice(0, 5).map((m) => m.file).join(', ')}</strong>
          {im.hint && <div style={{ marginTop: 6 }}>{t('mc.f.extHint', { wrote: im.hint.wrote, actual: im.hint.actual })}</div>}</>} />);
    } else if (im.referenced) rows.push(<Row key="io" level="ok" title={t('mc.f.imagesOk', { n: im.found })} />);
  }
  if (v.rawCidPath) rows.push(<Row key="rc" level="warn" title={t('meta.rawCid', { example: '' })} />);
  return <>{rows}</>;
}
