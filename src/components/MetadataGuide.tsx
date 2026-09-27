// Guides shown beside the Create form: how to prepare a metadata folder (with downloadable examples),
// and how the pre-reveal placeholder works.
import { useI18n } from '../i18n';
import { download, makeZip } from '../lib/zip';
import { IconCheck, IconClose } from './Icons';

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

Your collection needs TWO folders on IPFS (for example Pinata):

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
   Create -> Supply and art -> "I already have a metadata folder" and paste:
       ipfs://<METADATA FOLDER CID>/
   (with the "/" at the end). STABLE opens 1.json, 2.json, 3.json and your last token and shows
   what collectors will see before you deploy.

Common mistakes
 x  Uploading images one by one and writing ipfs://<that file's CID>/1.png
    (a single-file CID has nothing inside it, so the link does not open in wallets or marketplaces)
 x  Fewer JSON files than the max supply (the last tokens would have no image)
 x  Files named "1" instead of "1.json", or numbering that starts at 0
 x  Images or other files inside the metadata folder
`;

const README_KO = (supply: number) => `STABLE - 메타데이터 예시 키트
==============================

IPFS(예: Pinata)에 폴더 두 개가 필요합니다.

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
   만들기 -> 발행량 및 아트 -> "메타데이터 폴더가 이미 있어요" 에 붙여넣기:
       ipfs://<메타데이터 폴더 CID>/
   (끝에 "/" 포함). 배포 전에 1, 2, 3번과 마지막 토큰을 열어 컬렉터가 볼 화면을 보여줍니다.

자주 하는 실수
 x  이미지를 하나씩 올린 뒤 ipfs://<파일 CID>/1.png 로 쓰기 (단일 파일 CID 안에는 아무것도 없어 열리지 않음)
 x  JSON 파일 수가 최대 발행량보다 적음 (마지막 토큰에 이미지가 없음)
 x  "1.json" 대신 "1" 로 된 파일 이름, 또는 0부터 시작하는 번호
 x  메타데이터 폴더 안에 이미지나 다른 파일
`;

/** How to prepare the metadata folder, with a sample 1.json and a starter kit to download. */
export function MetadataGuide({ name, description, supply }: { name: string; description: string; supply: number }) {
  const { t, lang } = useI18n();
  const example = exampleMeta(1, name, description);

  function downloadExample() {
    download(new Blob([json(example)], { type: 'application/json' }), '1.json');
  }
  function downloadKit() {
    const files = [
      { name: 'stable-metadata-kit/README.txt', data: (lang === 'ko' ? README_KO : README_EN)(supply) },
      ...Array.from({ length: 3 }, (_, i) => ({ name: `stable-metadata-kit/metadata/${i + 1}.json`, data: json(exampleMeta(i + 1, name, description)) })),
    ];
    download(makeZip(files), 'stable-metadata-kit.zip');
  }

  return (
    <section className="meta-guide">
      <header className="meta-guide__head">
        <span className="guide-badge">{t('guide.badge')}</span>
        <span className="strong">{t('mg.title')}</span>
        <span className="small soft">{t('mg.sub')}</span>
      </header>
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
          <li className="is-do"><IconCheck size={14} />{t('mg.r5')}</li>
          <li className="is-dont"><IconClose size={14} />{t('mg.r3')}</li>
          <li className="is-dont"><IconClose size={14} />{t('mg.r4')}</li>
        </ul>
        <div className="row-wrap">
          <button type="button" className="btn btn--sm" onClick={downloadKit}>{t('mg.kit')}</button>
          <button type="button" className="btn btn--sm btn--outline" onClick={downloadExample}>{t('mg.example')}</button>
        </div>
      </div>
    </section>
  );
}

/** How the pre-reveal placeholder works and what to paste. */
export function PreRevealGuide({ name }: { name: string }) {
  const { t } = useI18n();
  const hidden = { name: `${name || 'My Collection'} (unrevealed)`, description: 'Revealing soon.', image: 'ipfs://bafy…/prereveal.png' };
  return (
    <section className="meta-guide">
      <header className="meta-guide__head">
        <span className="guide-badge">{t('guide.badge')}</span>
        <span className="strong">{t('pg.title')}</span>
        <span className="small soft">{t('pg.sub')}</span>
      </header>
      <div className="meta-guide__body">
        <ol className="meta-steps">
          <li>
            <span className="meta-steps__n">1</span>
            <div><div className="strong">{t('pg.s1')}</div><div className="small soft">{t('pg.s1Body')}</div></div>
          </li>
          <li>
            <span className="meta-steps__n">2</span>
            <div>
              <div className="strong">{t('pg.s2')}</div>
              <div className="small soft">{t('pg.s2Body')}</div>
              <pre className="meta-code" aria-label="hidden.json">
                {json(hidden).trimEnd().split('\n').map((line, i) => (
                  <span key={i}>{line.includes('"image"') ? <mark className="is-key">{line}</mark> : line}{'\n'}</span>
                ))}
              </pre>
            </div>
          </li>
          <li>
            <span className="meta-steps__n">3</span>
            <div><div className="strong">{t('pg.s3')}</div><div className="small soft">{t('pg.s3Body')}</div></div>
          </li>
        </ol>
        <ul className="meta-rules">
          <li className="is-do"><IconCheck size={14} />{t('pg.r1')}</li>
          <li className="is-do"><IconCheck size={14} />{t('pg.r2')}</li>
          <li className="is-dont"><IconClose size={14} />{t('pg.r3')}</li>
        </ul>
      </div>
    </section>
  );
}
