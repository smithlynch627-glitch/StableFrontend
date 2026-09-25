import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useSignMessage } from 'wagmi';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { errorMessage } from '../lib/actions';
import { eth, num, short, timeAgo, tokenLabel } from '../lib/format';
import { ensureSession } from '../lib/session';
import type { Collection, Order, Token, UserProfile } from '../lib/types';
import { Avatar, CollectionAvatar, CollectionBanner, TokenArt } from '../components/Art';
import { NftCard } from '../components/NftCard';
import { useTrade } from '../components/trade';
import { CopyButton, EmptyState, GridSkeleton, Modal, Skeleton, Tabs, useToast } from '../components/ui';
import { ActivityTab } from './Collection';
import { BackButton } from '../components/BackButton';

type Tab = 'items' | 'created' | 'listings' | 'made' | 'received' | 'activity';
const PAGE = 60;

export default function Profile() {
  const { address: raw = '' } = useParams();
  const addr = raw.toLowerCase();
  const { t } = useI18n();
  const { address: me } = useAccount();
  const isMe = !!me && me.toLowerCase() === addr;
  const [tab, setTab] = useState<Tab>('items');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setTab('items');
  }, [addr]);

  const profile = useQuery({ queryKey: ['user', addr], queryFn: () => api.get<UserProfile>(`/users/${addr}`) });
  const counts = profile.data?.counts;
  const name = profile.data?.user.username;

  return (
    <div className="page container">
      <div className="back-row"><BackButton /></div>
      <div className="profile-head">
        <Avatar address={addr || '0x0'} size={104} />
        <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 220 }}>
          {profile.isLoading ? <Skeleton h={34} w={240} /> : <h1 className="h1">{name || short(addr)}</h1>}
          <div className="row small soft" style={{ gap: 4 }}>{short(addr)}<CopyButton value={addr} /></div>
          {profile.data?.user.bio && <p className="soft" style={{ maxWidth: '60ch' }}>{profile.data.user.bio}</p>}
        </div>
        {isMe && <button className="btn btn--outline" onClick={() => setEditing(true)}>{t('profile.edit')}</button>}
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'items', label: t('profile.items'), count: counts?.owned },
          { id: 'created', label: t('profile.created'), count: profile.data?.collections?.length },
          { id: 'listings', label: t('profile.listings'), count: counts?.listed },
          { id: 'made', label: t('profile.offersMade'), count: counts?.offers_made },
          { id: 'received', label: t('profile.offersReceived') },
          { id: 'activity', label: t('profile.activity') },
        ]}
      />
      {tab === 'items' && <Items addr={addr} isMe={isMe} />}
      {tab === 'created' && <Created list={profile.data?.collections ?? []} isMe={isMe} />}
      {tab === 'listings' && <Orders path={`/users/${addr}/listings`} mode="listing" isMe={isMe} />}
      {tab === 'made' && <Orders path={`/users/${addr}/offers-made`} mode="made" isMe={isMe} />}
      {tab === 'received' && <Orders path={`/users/${addr}/offers-received`} mode="received" isMe={isMe} />}
      {tab === 'activity' && <ActivityTab address={addr} />}

      {isMe && editing && profile.data && <EditProfile p={profile.data} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Items({ addr, isMe }: { addr: string; isMe: boolean }) {
  const { t } = useI18n();
  const q = useInfiniteQuery({
    queryKey: ['user-tokens', addr],
    queryFn: ({ pageParam }) => api.get<{ tokens: Token[]; total: number }>(`/users/${addr}/tokens`, { limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE < last.total ? pages.length * PAGE : undefined),
  });
  const tokens = q.data?.pages.flatMap((p) => p.tokens) ?? [];
  if (q.isLoading) return <GridSkeleton />;
  if (!tokens.length) return <EmptyState title={t('profile.emptyItems')} action={isMe ? <Link className="btn" to="/launchpad">{t('profile.goLaunchpad')}</Link> : undefined} />;
  return (
    <>
      <div className="nft-grid">
        {tokens.map((tok) => (
          <NftCard
            key={`${tok.collection}:${tok.token_id}`}
            token={tok}
            collection={{ address: tok.collection, slug: tok.collection_slug!, art_style: tok.art_style!, name: tok.collection_name, tradable: tok.tradable, total_supply: tok.collection_supply }}
            showCollection
          />
        ))}
      </div>
      {q.hasNextPage && <div style={{ display: 'grid', placeItems: 'center', marginTop: 24 }}><button className="btn btn--outline" onClick={() => q.fetchNextPage()}>{t('common.loadMore')}</button></div>}
    </>
  );
}

function Created({ list, isMe }: { list: Collection[]; isMe: boolean }) {
  const { t, lang } = useI18n();
  if (!list.length) return <EmptyState title={t('profile.emptyCreated')} action={isMe ? <Link className="btn" to="/create">{t('lp.create')}</Link> : undefined} />;
  return (
    <div className="drop-grid">
      {list.map((c) => (
        <div key={c.address} className="col-card">
          <Link to={`/collection/${c.slug}`} className="col-card__banner" style={{ position: 'relative', display: 'block' }}><CollectionBanner collection={c} /></Link>
          <div className="col-card__body">
            <div className="col-card__avatar" style={{ position: 'relative' }}><CollectionAvatar collection={c} /></div>
            <div className="h3">{c.name}</div>
            <div className="small soft">{t('col.minted', { n: num(c.total_supply, lang), max: num(c.max_supply, lang) })}</div>
            {isMe && !c.is_external && <Link className="btn btn--sm" to={`/studio/${c.slug}`}>{t('col.manage')}</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Orders({ path, mode, isMe }: { path: string; mode: 'listing' | 'made' | 'received'; isMe: boolean }) {
  const { t, lang } = useI18n();
  const trade = useTrade();
  const q = useQuery({ queryKey: ['orders', path], queryFn: () => api.get<{ orders: Order[] }>(path) });
  const list = q.data?.orders ?? [];
  if (q.isLoading) return <Skeleton h={240} r={14} />;
  if (!list.length) return <EmptyState title={mode === 'listing' ? t('profile.emptyListings') : t('profile.emptyOffers')} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t('common.item')}</th>
            <th className="num">{t('common.price')}</th>
            {mode === 'received' && <th>{t('common.from')}</th>}
            <th>{t('common.expires')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((o) => {
            const col = { address: o.collection!, art_style: o.art_style };
            return (
              <tr key={o.hash}>
                <td>
                  <Link to={o.token_id ? `/item/${o.collection_slug}/${o.token_id}` : `/collection/${o.collection_slug}`} className="cell-item">
                    <span className="thumb thumb--sm" style={{ position: 'relative' }}>
                      <TokenArt collection={col} token={{ token_id: o.token_id ?? '6', image_url: o.token_image, attributes: o.token_attributes }} />
                    </span>
                    <span style={{ display: 'grid' }}>
                      <span className="strong small">{o.token_id ? tokenLabel(o.token_name, o.token_id) : t('col.collectionOffer')}</span>
                      <span className="tiny muted">{o.collection_name}</span>
                    </span>
                  </Link>
                </td>
                <td className="num strong">{eth(o.price_wei)} {o.kind === 'listing' ? 'ETH' : 'WETH'}</td>
                {mode === 'received' && <td><Link className="link" to={`/profile/${o.maker}`}>{short(o.maker)}</Link></td>}
                <td className="muted">{timeAgo(o.end_time, lang)}</td>
                <td style={{ textAlign: 'right' }}>
                  {isMe && mode !== 'received' && <button className="btn btn--outline btn--sm" onClick={() => trade.cancel(o, o.collection!)}>{mode === 'listing' ? t('item.cancelListing') : t('item.cancelOffer')}</button>}
                  {isMe && mode === 'received' && (
                    <button className="btn btn--sm" onClick={() => trade.accept(o, o.collection!)}>{t('item.accept')}</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditProfile({ p, onClose }: { p: UserProfile; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [username, setUsername] = useState(p.user.username ?? '');
  const [bio, setBio] = useState(p.user.bio ?? '');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!address) return;
    setBusy(true);
    try {
      const token = await ensureSession(address, (message) => signMessageAsync({ message }));
      await api.put('/users/me', { username: username.trim() || null, bio }, token);
      qc.invalidateQueries({ queryKey: ['user'] });
      toast(t('profile.saved'));
      onClose();
    } catch (e) {
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={t('profile.edit')} locked={busy}>
      <div className="field"><label htmlFor="u-name">{t('profile.username')}</label><input id="u-name" className="input" maxLength={24} value={username} onChange={(e) => setUsername(e.target.value)} /></div>
      <div className="field"><label htmlFor="u-bio">{t('profile.bio')}</label><textarea id="u-bio" className="textarea" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
      <button className="btn btn--lg btn--block" onClick={save} disabled={busy}>{busy && <span className="spinner" />}{t('profile.save')}</button>
    </Modal>
  );
}
