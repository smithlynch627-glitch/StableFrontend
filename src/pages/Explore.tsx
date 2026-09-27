import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import type { Collection } from '../lib/types';
import { CollectionCard } from '../components/CollectionCard';
import { EmptyState, Skeleton } from '../components/ui';

const PAGE = 24;

export default function Explore() {
  const { t } = useI18n();
  const [sort, setSort] = useState('volume_24h');
  const q = useInfiniteQuery({
    queryKey: ['collections', 'explore', sort],
    queryFn: ({ pageParam }) => api.get<{ collections: Collection[] }>('/collections', { sort, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.collections.length === PAGE ? pages.length * PAGE : undefined),
  });
  const cols = q.data?.pages.flatMap((p) => p.collections) ?? [];

  return (
    <div className="page container">
      <div className="page-head">
        <h1 className="h1">{t('explore.title')}</h1>
        <p className="lead">{t('explore.sub')}</p>
      </div>
      <div className="toolbar">
        <div className="row-wrap">
          {[
            ['volume_24h', t('explore.sortVolume24h')],
            ['volume', t('explore.sortVolume')],
            ['floor', t('explore.sortFloor')],
            ['new', t('explore.sortNew')],
          ].map(([id, label]) => (
            <button key={id} className="chip" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <div className="drop-grid">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={260} r={14} />)}</div>
      ) : cols.length === 0 ? (
        <EmptyState title={t('explore.empty')} action={<Link className="btn" to="/create">{t('home.launch')}</Link>} />
      ) : (
        <div className="drop-grid">
          {cols.map((c) => <CollectionCard key={c.address} c={c} />)}
        </div>
      )}
      {q.hasNextPage && (
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 28 }}>
          <button className="btn btn--outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>{t('common.loadMore')}</button>
        </div>
      )}
    </div>
  );
}
