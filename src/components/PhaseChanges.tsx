// "Mint configuration changed": the public notice on a drop page, and the change list it opens.
// The indexer records a change only when the owner edits phases (or pauses/resumes, or cuts supply)
// after the first phase has started, so an alert here always means minters could be affected.
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useAppConfig } from '../lib/appConfig';
import { dateTime, eth, num, timeAgo } from '../lib/format';
import type { PhaseChange, PhaseChangeEntry } from '../lib/types';
import { IconAlert, IconArrowRight, IconChevron, IconExternal, IconMinus, IconPlus } from './Icons';
import { Modal } from './ui';

const seenKey = (collection: string) => `stable.seenChange.${collection.toLowerCase()}`;
function readSeen(collection: string) {
  try { return Number(localStorage.getItem(seenKey(collection)) || 0); } catch { return 0; }
}
function writeSeen(collection: string, id: number) {
  try { localStorage.setItem(seenKey(collection), String(id)); } catch { /* per-viewer convenience only */ }
}

/** Banner under the drop title. Hidden when nothing changed after minting started. */
export function ConfigChangedAlert({ collection, changes }: { collection: string; changes?: PhaseChangeEntry[] }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(collection));
  const latest = changes?.[0];
  useEffect(() => setSeen(readSeen(collection)), [collection]);
  if (!latest) return null;
  const fresh = latest.id > seen;
  const total = changes!.reduce((s, e) => s + e.changes.length, 0);
  const show = () => {
    setOpen(true);
    writeSeen(collection, latest.id);
    setSeen(latest.id);
  };
  return (
    <>
      <button type="button" className={`cfg-alert ${fresh ? 'is-fresh' : ''}`} onClick={show} aria-haspopup="dialog">
        <span className="cfg-alert__icon"><IconAlert size={18} /></span>
        <span className="cfg-alert__text">
          <span className="strong">{t('chg.title')}</span>
          <span className="small">{t('chg.sub', { time: timeAgo(latest.changed_at, lang) })} · {t('chg.count', { n: total })}</span>
        </span>
        <span className="cfg-alert__cta small strong">{t('chg.view')}<IconArrowRight size={14} /></span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('chg.modalTitle')} width={560}>
        <div className="chg">
          <p className="small soft" style={{ margin: 0 }}>{t('chg.intro')}</p>
          {changes!.map((entry, i) => <ChangeEntry key={entry.id} entry={entry} defaultOpen={i < 3} isNew={entry.id > seen} />)}
        </div>
      </Modal>
    </>
  );
}

function ChangeEntry({ entry, defaultOpen, isNew }: { entry: PhaseChangeEntry; defaultOpen: boolean; isNew: boolean }) {
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const [open, setOpen] = useState(defaultOpen);
  const tx = entry.tx_hash?.split(':')[0];
  return (
    <section className={`chg__entry ${open ? 'is-open' : ''}`}>
      <button type="button" className="chg__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chg__time">
          <span className="strong">{dateTime(entry.changed_at, lang)}</span>
          <span className="tiny muted">{timeAgo(entry.changed_at, lang)} · {t('chg.count', { n: entry.changes.length })}</span>
        </span>
        {isNew && <span className="pill pill--solid">{t('chg.new')}</span>}
        <IconChevron size={16} className="chg__chev" />
      </button>
      {open && (
        <div className="chg__body">
          <ChangeList changes={entry.changes} />
          {tx && /^0x[0-9a-f]{64}$/i.test(tx) && (
            <a className="link tiny row" style={{ gap: 4, justifySelf: 'start' }} href={`${cfg.explorerUrl}/tx/${tx}`} target="_blank" rel="noreferrer">
              {t('chg.viewTx')} <IconExternal size={12} />
            </a>
          )}
        </div>
      )}
    </section>
  );
}

/** One row per change: "Allowlist · Price 0.01 ETH → 0.02 ETH". Also used for the Studio preview. */
export function ChangeList({ changes }: { changes: PhaseChange[] }) {
  const { t, lang } = useI18n();
  const v = (field: PhaseChange['field'], x: PhaseChange['from']): string => {
    if (field === 'price') return x === null || x === undefined ? '—' : BigInt(String(x)) === 0n ? t('lp.free') : `${eth(String(x), 6)} ETH`;
    if (field === 'start' || field === 'end') return x ? dateTime(String(x), lang) : t('chg.noEnd');
    if (field === 'maxPerWallet') return x ? t('drop.limit', { n: Number(x) }) : t('chg.noLimit');
    if (field === 'allowlist') return x === 'open' ? t('chg.open') : x === 'updated' ? t('chg.updated') : t('chg.allowlist');
    return String(x ?? '—');
  };
  const summary = (s: PhaseChange['after']) =>
    s ? [s.priceWei === '0' ? t('lp.free') : `${eth(s.priceWei, 6)} ETH`, dateTime(s.start, lang), s.maxPerWallet ? t('drop.limit', { n: s.maxPerWallet }) : t('chg.noLimit'), s.allowlist ? t('chg.allowlist') : t('chg.open')].join(' · ') : '';
  return (
    <ul className="chg__list">
      {changes.map((c, i) => {
        if (c.type === 'added' || c.type === 'removed')
          return (
            <li key={i} className={`chg__row chg__row--${c.type}`}>
              <span className="chg__badge">{c.type === 'added' ? <IconPlus size={13} /> : <IconMinus size={13} />}</span>
              <span className="chg__main">
                <span className="strong">{t(c.type === 'added' ? 'chg.added' : 'chg.removed', { phase: c.phase || '' })}</span>
                {c.type === 'added' && c.after && <span className="tiny muted">{summary(c.after)}</span>}
              </span>
            </li>
          );
        if (c.type === 'paused' || c.type === 'resumed' || c.type === 'supply')
          return (
            <li key={i} className="chg__row">
              <span className="chg__badge"><IconAlert size={13} /></span>
              <span className="chg__main"><span className="strong">{c.type === 'supply' ? t('chg.supply', { n: num(Number(c.to), lang) }) : t(c.type === 'paused' ? 'chg.paused' : 'chg.resumed')}</span></span>
            </li>
          );
        return (
          <li key={i} className="chg__row">
            <span className="chg__badge chg__badge--edit" />
            <span className="chg__main">
              <span className="small"><span className="strong">{c.phase}</span> <span className="muted">· {t(`chg.field.${c.field}` as never)}</span></span>
              <span className="chg__fromto">
                <s className="muted">{v(c.field, c.from)}</s>
                <IconArrowRight size={13} />
                <span className="strong">{v(c.field, c.to)}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
