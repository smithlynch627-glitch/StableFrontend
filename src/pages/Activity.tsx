import { useI18n } from '../i18n';
import { ActivityTab } from './Collection';

export default function ActivityPage() {
  const { t } = useI18n();
  return (
    <div className="page container">
      <div className="page-head">
        <h1 className="h1">{t('act.title')}</h1>
        <p className="lead">{t('act.sub')}</p>
      </div>
      <ActivityTab />
    </div>
  );
}
