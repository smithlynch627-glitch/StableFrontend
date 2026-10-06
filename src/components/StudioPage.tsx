// Creator Studio → "Page & images": everything on the collection and mint pages that is not on-chain
// (logo, banner, up to three extra images, description, links and the About tab). Saving is free: the
// owner signs in with the wallet once and the details are stored by STABLE.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import type { Collection } from '../lib/types';
import { useAuthedApi } from '../lib/tx';
import { GalleryField, ImageField, ImageLinkRow, linkBlocks, type LinkState } from './CreateArt';
import { IconClose, IconExternal, IconPlus } from './Icons';
import { useToast } from './ui';
import { XConnect } from './XConnect';

type Saved = { collection: Collection; warnings?: string[] };
type Row = { id: number; label: string; value: string };
const MAX_ROWS = 12;
/** Pictures embedded by an older version (not links): they stay until the creator pastes a link. */
const embedded = (v?: string | null) => !!v && v.startsWith('data:');
let seq = 0;

export function StudioPage({ c }: { c: Collection }) {
  const { t } = useI18n();
  const toast = useToast();
  const authed = useAuthedApi();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'images' | 'details' | 'about' | null>(null);

  async function save(kind: 'images' | 'details' | 'about', body: Record<string, unknown>, done: string) {
    setBusy(kind);
    try {
      const res = await authed.post<Saved>('/drops', { collection: c.address, ...body });
      qc.setQueryData(['collection', c.slug.toLowerCase()], (old: any) => (old ? { ...old, collection: { ...old.collection, ...res.collection } } : old));
      qc.invalidateQueries({ queryKey: ['drop', c.slug.toLowerCase()] });
      qc.invalidateQueries({ queryKey: ['drops'] });
      if (res.warnings?.includes('gallery_not_ready')) toast(t('studio.extraNotReady'), 'error');
      else toast(done);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  // ── Images ──────────────────────────────────────────────────────────────
  const [logo, setLogo] = useState<string | null>(embedded(c.image_url) ? null : c.image_url);
  const [banner, setBanner] = useState<string | null>(embedded(c.banner_url) ? null : c.banner_url);
  const [gallery, setGallery] = useState<string[]>(c.gallery || []);
  const [st, setSt] = useState<{ logo: LinkState; banner: LinkState }>({ logo: 'idle', banner: 'idle' });
  const [extraBlocked, setExtraBlocked] = useState(false);
  const keepBanner = embedded(c.banner_url) && st.banner === 'idle';
  const imagesBlocked = linkBlocks(st.logo) || linkBlocks(st.banner) || extraBlocked;
  const saveImages = () =>
    // An empty logo field keeps the current logo (a collection always has one); an empty banner removes it.
    save('images', { ...(logo ? { imageUrl: logo } : {}), ...(keepBanner ? {} : { bannerUrl: banner }), gallery: gallery.slice(0, 3) }, t('studio.imagesSaved'));

  // ── Description and links ───────────────────────────────────────────────
  const [d, setD] = useState({ description: c.description || '', discord: c.discord || '', telegram: c.telegram || '', website: c.website || '' });
  const [xUser, setXUser] = useState<string | null>(null);
  // The X link is set by the API from the owner's connected account; it is only sent when one is connected.
  const saveDetails = () => save('details', { ...d, ...(xUser ? { twitter: `https://x.com/${xUser}` } : {}) }, t('profile.saved'));

  // ── About tab ───────────────────────────────────────────────────────────
  const [about, setAbout] = useState(c.about || '');
  const [aboutImg, setAboutImg] = useState(c.about_image_url || '');
  const [aboutImgState, setAboutImgState] = useState<LinkState>('idle');
  const [rows, setRows] = useState<Row[]>(() => (c.about_items || []).map((x) => ({ id: ++seq, label: x.label, value: x.value })));
  const setRow = (id: number, patch: Partial<Row>) => setRows((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const saveAbout = () =>
    save('about', {
      about: about.trim() || null,
      aboutImageUrl: aboutImg || null,
      aboutItems: rows.filter((r) => r.label.trim() && r.value.trim()).map(({ label, value }) => ({ label: label.trim(), value: value.trim() })),
    }, t('studio.aboutSaved'));

  const spin = (k: typeof busy) => busy === k && <span className="spinner" />;
  return (
    <>
      <p className="small soft" style={{ margin: 0 }}>{t('studio.pageIntro')}</p>

      <section className="card card--pad studio-block">
        <header className="studio-block__head">
          <span className="strong">{t('studio.images')}</span>
          <span className="small soft">{t('studio.imagesSub')}</span>
        </header>
        <div className="image-fields">
          <div style={{ display: 'grid', gap: 6 }}>
            <ImageField label={t('create.logo')} spec={{ w: 400, h: 400 }} square value={logo} onChange={setLogo} onState={(s) => setSt((x) => ({ ...x, logo: s }))} />
            {st.logo === 'idle' && <span className="hint">{embedded(c.image_url) ? t('studio.embeddedImage') : t('studio.logoKept')}</span>}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <ImageField label={t('create.banner')} spec={{ w: 1500, h: 500 }} value={banner} onChange={setBanner} onState={(s) => setSt((x) => ({ ...x, banner: s }))} />
            {keepBanner && <span className="hint">{t('studio.embeddedImage')}</span>}
          </div>
        </div>
        <GalleryField value={gallery} onChange={setGallery} onBlocked={setExtraBlocked} />
        <div className="row-wrap">
          <button className="btn" disabled={imagesBlocked || !!busy} onClick={saveImages}>{spin('images')}{t('studio.saveImages')}</button>
          <Link className="btn btn--outline btn--sm" to={`/launchpad/${c.slug}`} target="_blank" rel="noreferrer">{t('lp.view')}<IconExternal size={13} /></Link>
          {imagesBlocked && <span className="hint">{t('studio.imagesWait')}</span>}
        </div>
      </section>

      <section className="card card--pad studio-block">
        <header className="studio-block__head">
          <span className="strong">{t('studio.profile')}</span>
          <span className="small soft">{t('studio.profileSub')}</span>
        </header>
        <div className="field">
          <label htmlFor="sp-desc">{t('create.description')}</label>
          <textarea id="sp-desc" className="textarea" maxLength={2000} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <span className="hint mono-num">{d.description.trim().length}/2000</span>
        </div>
        <div className="field">
          <span className="label">{t('create.twitter')}</span>
          <XConnect returnPath={`/studio/${c.slug}`} onChange={setXUser} />
          <span className="hint">{c.twitter ? t('studio.xNow', { link: c.twitter.replace(/^https:\/\/(www\.)?(x|twitter)\.com\//, '@') }) : t('studio.xNone')}</span>
        </div>
        <div className="field"><label htmlFor="sp-dc">{t('col.discord')}</label><input id="sp-dc" className="input" value={d.discord} placeholder="https://discord.gg/..." onChange={(e) => setD({ ...d, discord: e.target.value.trim() })} /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="sp-tg">{t('create.telegram')}</label><input id="sp-tg" className="input" value={d.telegram} placeholder="https://t.me/..." onChange={(e) => setD({ ...d, telegram: e.target.value.trim() })} /></div>
          <div className="field"><label htmlFor="sp-web">{t('create.website')}</label><input id="sp-web" className="input" value={d.website} placeholder="https://" onChange={(e) => setD({ ...d, website: e.target.value.trim() })} /></div>
        </div>
        <button className="btn" style={{ justifySelf: 'start' }} disabled={!!busy} onClick={saveDetails}>{spin('details')}{t('studio.saveProfile')}</button>
      </section>

      <section className="card card--pad studio-block">
        <header className="studio-block__head">
          <span className="strong">{t('studio.about')}</span>
          <span className="small soft">{t('studio.aboutSub')}</span>
        </header>
        <div className="field">
          <label htmlFor="sp-about">{t('studio.aboutStory')}</label>
          <textarea id="sp-about" className="textarea" style={{ minHeight: 160 }} maxLength={8000} value={about} placeholder={t('studio.aboutStoryPh')} onChange={(e) => setAbout(e.target.value)} />
          <span className="hint mono-num">{about.trim().length}/8000</span>
        </div>
        <div className="field">
          <span className="label">{t('studio.aboutImage')} <span className="muted">({t('create.optional')})</span></span>
          <ImageLinkRow label={t('studio.aboutImage')} value={aboutImg} onChange={setAboutImg} onState={setAboutImgState} />
          {aboutImgState === 'idle' && <span className="hint">{t('studio.aboutImageHint')}</span>}
        </div>
        <div className="field">
          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <span className="label" style={{ marginBottom: 0 }}>{t('studio.aboutRows')} <span className="muted">({t('create.optional')})</span></span>
            <span className="tiny muted mono-num">{rows.length} / {MAX_ROWS}</span>
          </div>
          <span className="hint">{t('studio.aboutRowsHint')}</span>
          {rows.map((r) => (
            <div className="kv-row" key={r.id}>
              <input className="input" value={r.label} maxLength={40} placeholder={t('studio.aboutRowLabel')} aria-label={t('studio.aboutRowLabel')} onChange={(e) => setRow(r.id, { label: e.target.value })} />
              <input className="input" value={r.value} maxLength={300} placeholder={t('studio.aboutRowValue')} aria-label={t('studio.aboutRowValue')} onChange={(e) => setRow(r.id, { value: e.target.value })} />
              <button type="button" className="icon-btn" onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label={t('img.remove')} title={t('img.remove')}><IconClose size={16} /></button>
            </div>
          ))}
          {rows.length < MAX_ROWS && (
            <button type="button" className="btn btn--outline btn--sm" style={{ justifySelf: 'start' }} onClick={() => setRows((x) => [...x, { id: ++seq, label: '', value: '' }])}>
              <IconPlus size={14} />{t('studio.aboutAddRow')}
            </button>
          )}
        </div>
        <div className="row-wrap">
          <button className="btn" disabled={linkBlocks(aboutImgState) || !!busy} onClick={saveAbout}>{spin('about')}{t('studio.saveAbout')}</button>
          <Link className="btn btn--outline btn--sm" to={`/collection/${c.slug}?tab=about`} target="_blank" rel="noreferrer">{t('studio.aboutOpen')}<IconExternal size={13} /></Link>
        </div>
      </section>
    </>
  );
}
