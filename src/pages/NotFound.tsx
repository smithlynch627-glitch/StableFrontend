import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { CowImage } from '../components/Art';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page container" style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 18 }}>
      <div style={{ width: 180, height: 180, borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line)', position: 'relative' }}>
        <CowImage index={3} alt="" />
      </div>
      <h1 className="h1">{t('nf.title')}</h1>
      <p className="lead">{t('nf.body')}</p>
      <Link className="btn btn--lg" to="/">{t('nf.home')}</Link>
    </div>
  );
}
