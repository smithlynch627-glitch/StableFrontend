import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

/** Goes back in history when the user came from inside the site, otherwise to a sensible parent page. */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="back-btn"
      onClick={() => (loc.key !== 'default' && window.history.length > 1 ? nav(-1) : nav(fallback))}
      aria-label={t('common.back')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      <span>{t('common.back')}</span>
    </button>
  );
}
