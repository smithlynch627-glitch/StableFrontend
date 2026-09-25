import { Link } from 'react-router-dom';
import { BRAND, GIWA_COWS, LINKS, activeChain } from '../config';
import { useI18n } from '../i18n';
import { LangToggle } from './Header';
import { SocialLink } from './Social';
import { Logo } from './Logo';
import { useAppConfig } from '../lib/appConfig';

export function Footer() {
  const { t } = useI18n();
  const { socials } = useAppConfig();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div className="row">
              <Logo size={34} />
              <span className="strong">{BRAND.name}</span>
              <span className="small muted">{BRAND.tagline}</span>
            </div>
            <p className="small soft" style={{ maxWidth: 360 }}>{t('home.sub')}</p>
            {(socials?.x || socials?.discord || socials?.telegram) && (
              <div className="row" style={{ gap: 10 }} aria-label={t('footer.community')}>
                {socials?.x && <SocialLink kind="x" href={socials.x} />}
                {socials?.discord && <SocialLink kind="discord" href={socials.discord} />}
                {socials?.telegram && <SocialLink kind="telegram" href={socials.telegram} />}
              </div>
            )}
            <LangToggle />
          </div>
          <div>
            <h4>{t('footer.market')}</h4>
            <Link to="/explore">{t('nav.explore')}</Link>
            <Link to="/launchpad">{t('nav.launchpad')}</Link>
            <Link to="/activity">{t('nav.activity')}</Link>
            <Link to="/create">{t('nav.create')}</Link>
            <Link to={`/${GIWA_COWS.slug}`}>{GIWA_COWS.name}</Link>
          </div>
          <div>
            <h4>{t('footer.resources')}</h4>
            <Link to="/support">{t('nav.support')}</Link>
            <Link to="/terms">{t('legal.termsFull')}</Link>
            <Link to="/privacy">{t('legal.privacyFull')}</Link>
            <a href={LINKS.docs} target="_blank" rel="noreferrer">{t('footer.docs')}</a>
            <a href={activeChain.blockExplorers?.default.url} target="_blank" rel="noreferrer">{t('footer.explorer')}</a>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} {BRAND.name}: {BRAND.tagline}</span>
          <span>{t('footer.builtOn')}</span>
        </div>
      </div>
    </footer>
  );
}
