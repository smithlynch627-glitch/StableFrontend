// Metadata help on the Create page: what to upload to Pinata (with downloadable examples),
// and a generator that writes every 1.json … N.json from an images folder CID (+ optional traits CSV).
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { download, makeZip } from '../lib/zip';
import { IconAlert, IconCheck, IconClose } from './Icons';

const EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] as const;
const CID = /(?:ipfs:\/\/|\/ipfs\/)?(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})/;
const MAX_FILES = 65_000;
const EXAMPLE_CID = 'bafybeiexampleimagesfolderciddonotusethis1234567890abc';

type Meta = { name: string; description?: string; image: string; attributes?: { trait_type: string; value: string }[] };

function exampleMeta(id: number, name: string, description: string, cid = EXAMPLE_CID, ext = 'png'): Meta {
  const traits = [
    ['Background', ['Blue', 'Cream', 'Navy'][(id - 1) % 3]],
    ['Eyes', ['Laser', 'Sleepy', 'Normal'][(id - 1) % 3]],
    ['Mouth', ['Smile', 'Open', 'Smile'][(id - 1) % 3]],
  ];
  return {
    name: `${name || 'My Collection'} #${id}`,
    description: description || 'Describe your collection here.',
    image: `ipfs://${cid}/${id}.${ext}`,
    attributes: traits.map(([trait_type, value]) => ({ trait_type, value })),
  };
}

const json = (m: unknown) => `${JSON.stringify(m, null, 2)}\n`;

const README_EN = (supply: number) => `STABLE - metadata starter kit
==============================

Your collection needs TWO folders on IPFS (Pinata):

1) IMAGES FOLDER
   Put every image in one folder, named by token number, all with the same extension:
       images/1.png  images/2.png  images/3.png  ...  images/${supply || 'N'}.png
   Pinata -> Add -> Folder -> choose the folder. Copy the folder CID (starts with "bafy" or "Qm").

2) METADATA FOLDER
   One JSON file per token, named 1.json, 2.json ... up to your supply (${supply || 'N'}).
   Use metadata/1.json in this kit as the template. The "image" line points INSIDE the images folder:
       "image": "ipfs://<IMAGES FOLDER CID>/1.png"
   Only .json files go in this folder. Upload it to Pinata as a folder and copy its CID.

3) ON STABLE
   Create -> Supply and art -> "I already have an IPFS folder" and paste:
       ipfs://<METADATA FOLDER CID>/
   (with the "/" at the end). STABLE opens 1.json, 2.json, 3.json and your last token and shows
   what collectors will see before you deploy.

Shortcut: on the Create page, "Make my metadata files" writes all the JSON files for you from your
images folder CID (and an optional traits CSV - see traits-template.csv).

Common mistakes
 x  Uploading images one by one and writing ipfs://<that file's CID>/1.png
    (a single-file CID has nothing inside it, so the link does not open in wallets or marketplaces)
 x  Fewer JSON files than the max supply (the last tokens would have no image)
 x  Files named "1" instead of "1.json", or numbering that starts at 0
 x  Images or other files inside the metadata folder
`;

const README_KO = (supply: number) => `STABLE - 메타데이터 예시 키트
==============================

IPFS(Pinata)에 폴더 두 개가 필요합니다.

1) 이미지 폴더
   모든 이미지를 한 폴더에 토큰 번호로 이름을 붙여 넣습니다(확장자는 모두 같게):
       images/1.png  images/2.png  images/3.png  ...  images/${supply || 'N'}.png
   Pinata -> Add -> Folder 로 폴더를 올리고 폴더 CID("bafy" 또는 "Qm"로 시작)를 복사하세요.

2) 메타데이터 폴더
   토큰마다 JSON 파일 하나: 1.json, 2.json ... 최대 발행량(${supply || 'N'})까지.
   이 키트의 metadata/1.json 을 템플릿으로 쓰세요. "image"는 이미지 폴더 안을 가리켜야 합니다:
       "image": "ipfs://<이미지 폴더 CID>/1.png"
   이 폴더에는 .json 파일만 넣고, 폴더로 Pinata에 올린 뒤 CID를 복사하세요.

3) STABLE에서
   Create -> 발행량 및 아트 -> "IPFS 폴더가 이미 있어요" 에 붙여넣기:
       ipfs://<메타데이터 폴더 CID>/
   (끝에 "/" 포함). 배포 전에 1, 2, 3번과 마지막 토큰을 열어 컬렉터가 볼 화면을 보여줍니다.

바로가기: Create 페이지의 "메타데이터 파일 만들기"가 이미지 폴더 CID(와 선택 사항인 특성 CSV)로
모든 JSON 파일을 만들어 줍니다. traits-template.csv 를 참고하세요.

자주 하는 실수
 x  이미지를 하나씩 올린 뒤 ipfs://<파일 CID>/1.png 로 쓰기 (단일 파일 CID 안에는 아무것도 없어 열리지 않음)
 x  JSON 파일 수가 최대 발행량보다 적음 (마지막 토큰에 이미지가 없음)
 x  "1.json" 대신 "1" 로 된 파일 이름, 또는 0부터 시작하는 번호
 x  메타데이터 폴더 안에 이미지나 다른 파일
`;

const TRAITS_CSV = 'id,Background,Eyes,Mouth\n1,Blue,Laser,Smile\n2,Cream,Sleepy,Open\n3,Navy,Normal,Smile\n';

/** Minimal CSV reader (quotes, commas, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

type Traits = { byId: Map<number, Record<string, string>>; columns: string[] };
function readTraits(text: string): Traits {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('empty');
  const head = rows[0];
  if (!/^(id|token_?id|tokenid|#)$/i.test(head[0])) throw new Error('first column');
  const byId = new Map<number, Record<string, string>>();
  for (const r of rows.slice(1)) {
    const id = Number(r[0]);
    if (!Number.isInteger(id) || id < 1) continue;
    const rec: Record<string, string> = {};
    head.slice(1).forEach((h, i) => { if (h && r[i + 1] !== undefined && r[i + 1] !== '') rec[h] = r[i + 1]; });
    byId.set(id, rec);
  }
  return { byId, columns: head.slice(1).filter((h) => h && !/^(name|description|image)$/i.test(h)) };
}

export function MetadataGuide({ name, description, supply }: { name: string; description: string; supply: number }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<'guide' | 'make'>('guide');
  const example = exampleMeta(1, name, description);

  function downloadExample() {
    download(new Blob([json(example)], { type: 'application/json' }), '1.json');
  }
  function downloadKit() {
    const n = 3; // three examples are enough to see the pattern
    const files = [
      { name: 'stable-metadata-kit/README.txt', data: (lang === 'ko' ? README_KO : README_EN)(supply) },
      ...Array.from({ length: n }, (_, i) => ({ name: `stable-metadata-kit/metadata/${i + 1}.json`, data: json(exampleMeta(i + 1, name, description)) })),
      { name: 'stable-metadata-kit/traits-template.csv', data: TRAITS_CSV },
    ];
    download(makeZip(files), 'stable-metadata-kit.zip');
  }

  return (
    <section className="meta-guide">
      <header className="meta-guide__head">
        <div style={{ display: 'grid', gap: 2 }}>
          <span className="strong">{t('mg.title')}</span>
          <span className="small soft">{t('mg.sub')}</span>
        </div>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-pressed={tab === 'guide'} onClick={() => setTab('guide')}>{t('mg.tabGuide')}</button>
          <button type="button" role="tab" aria-pressed={tab === 'make'} onClick={() => setTab('make')}>{t('mg.tabMake')}</button>
        </div>
      </header>

      {tab === 'guide' ? (
        <div className="meta-guide__body">
          <ol className="meta-steps">
            <li>
              <span className="meta-steps__n">1</span>
              <div>
                <div className="strong">{t('mg.s1')}</div>
                <div className="small soft">{t('mg.s1Body')}</div>
                <div className="tree"><span className="tree__dir">images/</span><span>1.png</span><span>2.png</span><span>3.png</span><span className="muted">… {supply ? `${supply}.png` : 'N.png'}</span><span className="tree__arrow">→ {t('mg.imagesCid')}</span></div>
              </div>
            </li>
            <li>
              <span className="meta-steps__n">2</span>
              <div>
                <div className="strong">{t('mg.s2')}</div>
                <div className="small soft">{t('mg.s2Body', { n: supply || 'N' })}</div>
                <div className="tree"><span className="tree__dir">metadata/</span><span>1.json</span><span>2.json</span><span>3.json</span><span className="muted">… {supply ? `${supply}.json` : 'N.json'}</span><span className="tree__arrow">→ {t('mg.metaCid')}</span></div>
                <pre className="meta-code" aria-label="1.json">
                  {json(example).trimEnd().split('\n').map((line, i) => (
                    <span key={i}>{line.includes('"image"') ? <mark className="is-key">{line}</mark> : line}{'\n'}</span>
                  ))}
                </pre>
              </div>
            </li>
            <li>
              <span className="meta-steps__n">3</span>
              <div>
                <div className="strong">{t('mg.s3')}</div>
                <div className="small soft">{t('mg.s3Body')}</div>
                <code className="meta-inline">ipfs://&lt;{t('mg.metaCidShort')}&gt;/</code>
              </div>
            </li>
          </ol>
          <ul className="meta-rules">
            <li className="is-do"><IconCheck size={14} />{t('mg.r1', { n: supply || 'N' })}</li>
            <li className="is-do"><IconCheck size={14} />{t('mg.r2')}</li>
            <li className="is-dont"><IconClose size={14} />{t('mg.r3')}</li>
            <li className="is-dont"><IconClose size={14} />{t('mg.r4')}</li>
          </ul>
          <div className="row-wrap">
            <button type="button" className="btn btn--sm" onClick={downloadKit}>{t('mg.kit')}</button>
            <button type="button" className="btn btn--sm btn--outline" onClick={downloadExample}>{t('mg.example')}</button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setTab('make')}>{t('mg.orMake')}</button>
          </div>
        </div>
      ) : (
        <Generator name={name} description={description} supply={supply} />
      )}
    </section>
  );
}

function Generator({ name, description, supply }: { name: string; description: string; supply: number }) {
  const { t } = useI18n();
  const [cidText, setCidText] = useState('');
  const [ext, setExt] = useState<(typeof EXTS)[number]>('png');
  const [title, setTitle] = useState(name);
  const [desc, setDesc] = useState(description);
  const [count, setCount] = useState(String(supply || ''));
  const [traits, setTraits] = useState<Traits | null>(null);
  const [traitsName, setTraitsName] = useState('');
  const [traitsErr, setTraitsErr] = useState<string | null>(null);

  const cid = cidText.match(CID)?.[1] || '';
  const n = Number(count);
  const problem = !cidText.trim()
    ? null
    : !cid
      ? t('mg.errCid')
      : /^bafkrei/i.test(cid)
        ? t('mg.errSingle')
        : null;
  const countOk = Number.isInteger(n) && n >= 1 && n <= MAX_FILES;
  const missingTraits = traits ? Array.from({ length: Math.min(n || 0, MAX_FILES) }, (_, i) => i + 1).filter((id) => !traits.byId.has(id)).length : 0;

  const make = (id: number): Meta => {
    // Optional CSV columns "name", "description" and "image" override the defaults; every other column is a trait.
    let nameCol = '';
    let descCol = '';
    let imageCol = '';
    const attributes: { trait_type: string; value: string }[] = [];
    for (const [k, v] of Object.entries(traits?.byId.get(id) || {})) {
      const key = k.toLowerCase();
      if (key === 'name') nameCol = v;
      else if (key === 'description') descCol = v;
      else if (key === 'image') imageCol = v;
      else attributes.push({ trait_type: k, value: v });
    }
    return {
      name: nameCol || `${title.trim() || 'Token'} #${id}`,
      ...(descCol || desc.trim() ? { description: descCol || desc.trim() } : {}),
      image: imageCol || `ipfs://${cid || '<IMAGES_FOLDER_CID>'}/${id}.${ext}`,
      ...(attributes.length ? { attributes } : {}),
    };
  };
  const preview = useMemo(() => json(make(1)), [cid, ext, title, desc, traits]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickCsv(file?: File) {
    if (!file) return;
    setTraitsErr(null);
    try {
      setTraits(readTraits(await file.text()));
      setTraitsName(file.name);
    } catch {
      setTraits(null);
      setTraitsName('');
      setTraitsErr(t('mg.errCsv'));
    }
  }

  function generate() {
    const files = Array.from({ length: n }, (_, i) => ({ name: `metadata/${i + 1}.json`, data: json(make(i + 1)) }));
    download(makeZip(files), 'metadata.zip');
  }

  return (
    <div className="meta-guide__body">
      <p className="small soft" style={{ margin: 0 }}>{t('mg.makeIntro')}</p>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="mg-cid">{t('mg.cidLabel')}<span className="req">*</span></label>
          <input id="mg-cid" className="input" value={cidText} onChange={(e) => setCidText(e.target.value.trim())} placeholder="bafybei… / ipfs://bafybei…/" spellCheck={false} />
          {problem ? <span className="hint" style={{ color: 'var(--bad)' }}>{problem}</span> : cid ? <span className="hint hint--good">{t('mg.cidOk')}</span> : <span className="hint">{t('mg.cidHint')}</span>}
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="mg-ext">{t('mg.ext')}</label>
            <select id="mg-ext" className="select" value={ext} onChange={(e) => setExt(e.target.value as (typeof EXTS)[number])}>
              {EXTS.map((x) => <option key={x} value={x}>.{x}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mg-n">{t('mg.count')}</label>
            <input id="mg-n" className="input" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="mg-name">{t('mg.name')}</label>
          <input id="mg-name" className="input" maxLength={64} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Collection" />
          <span className="hint">{t('mg.nameHint', { name: `${title.trim() || 'Token'} #1` })}</span>
        </div>
        <div className="field">
          <label htmlFor="mg-desc">{t('mg.desc')}</label>
          <input id="mg-desc" className="input" maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{t('mg.traits')} <span className="muted">({t('create.optional')})</span></label>
        <div className="row-wrap">
          <label className="btn btn--sm btn--outline" style={{ cursor: 'pointer' }}>
            {traitsName ? t('mg.csvChange') : t('mg.csvPick')}
            <input type="file" hidden accept=".csv,text/csv" onChange={(e) => { pickCsv(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => download(new Blob([TRAITS_CSV], { type: 'text/csv' }), 'traits-template.csv')}>{t('mg.csvTemplate')}</button>
          {traits && <span className="small">{traitsName} · {t('mg.csvRead', { rows: traits.byId.size, cols: traits.columns.length })}</span>}
          {traits && <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setTraits(null); setTraitsName(''); }}>{t('mg.csvClear')}</button>}
        </div>
        <span className="hint">{t('mg.csvHint')}</span>
        {traitsErr && <div className="notice notice--strong small"><IconAlert size={14} />{traitsErr}</div>}
        {traits && missingTraits > 0 && countOk && <div className="notice notice--warn small"><IconAlert size={14} />{t('mg.csvMissing', { n: missingTraits })}</div>}
      </div>
      <div className="field">
        <span className="label">{t('mg.preview')}</span>
        <pre className="meta-code">{preview}</pre>
      </div>
      <div className="row-wrap">
        <button type="button" className="btn" disabled={!cid || !!problem || !countOk} onClick={generate}>{t('mg.download', { n: countOk ? n.toLocaleString() : '…' })}</button>
        {!countOk && count && <span className="small" style={{ color: 'var(--bad)' }}>{t('mg.errCount', { max: MAX_FILES.toLocaleString() })}</span>}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>{t('mg.after')}</p>
    </div>
  );
}
