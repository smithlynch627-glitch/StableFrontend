import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import type { DropListItem } from '../lib/types';
import { DropCard } from '../components/DropCard';
import { EmptyState, Skeleton, Tabs } from '../components/ui';
import type { DictKey } from '../i18n/en';

type Tab = 'live' | 'upcoming' | 'ended';

export default function Launchpad() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab') as Tab | null;
  const [picked, setPicked] = useState<Tab | null>(asked && ['live', 'upcoming', 'ended'].includes(asked) ? asked : null);
  const { data, isLoading } = useQuery({ queryKey: ['drops', 'all'], queryFn: () => api.get<{ drops: DropListItem[] }>('/drops') });
  const all = data?.drops ?? [];
  const by = (s: Tab) => all.filter((d) => (s === 'ended' ? d.status === 'ended' || d.status === 'sold_out' : d.status === s));
  // Open on the first tab that has drops (a brand-new drop usually starts as "upcoming").
  const tab: Tab = picked ?? (by('live').length ? 'live' : by('upcoming').length ? 'upcoming' : 'live');
  const setTab = (x: Tab) => { setPicked(x); setParams({ tab: x }, { replace: true }); };
  const list = by(tab);
  const empty: Record<Tab, DictKey> = { live: 'lp.emptyLive', upcoming: 'lp.emptyUpcoming', ended: 'lp.emptyEnded' };

  return (
    <div className="page container">
      <div className="section__head" style={{ alignItems: 'flex-end', marginBottom: 28 }}>
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1 className="h1">{t('lp.title')}</h1>
          <p className="lead">{t('lp.sub')}</p>
        </div>
        <Link to="/create" className="btn btn--lg">{t('lp.create')}</Link>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'live', label: t('lp.live'), count: by('live').length },
          { id: 'upcoming', label: t('lp.upcoming'), count: by('upcoming').length },
          { id: 'ended', label: t('lp.ended'), count: by('ended').length },
        ]}
      />
      {isLoading ? (
        <div className="drop-grid">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={330} r={14} />)}</div>
      ) : list.length === 0 ? (
        <EmptyState title={t(empty[tab])} action={<Link className="btn btn--outline" to="/create">{t('lp.create')}</Link>} />
      ) : (
        <div className="drop-grid">{list.map((d) => <DropCard key={d.collection.address} d={d} />)}</div>
      )}
    </div>
  );
}
