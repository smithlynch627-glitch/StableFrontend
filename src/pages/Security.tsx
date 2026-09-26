// Security Center: what STABLE's contracts are allowed to do with your wallet, and one-click ways to take it back.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readContract } from 'wagmi/actions';
import { useAccount, useSignMessage } from 'wagmi';
import { PINNED, activeChain } from '../config';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { useAppConfig } from '../lib/appConfig';
import { cancelAllOrders, errorMessage, revokeNftApproval, revokeWeth, type ActionCtx } from '../lib/actions';
import { collectionAbi, wethAbi } from '../lib/abis';
import { eth, short } from '../lib/format';
import type { Address, Collection, Token } from '../lib/types';
import { wagmiConfig } from '../lib/wagmi';
import { CollectionAvatar } from '../components/Art';
import { IconAlert, IconCheck, IconExternal, IconLock } from '../components/Icons';
import { useWalletUI } from '../components/wallet';
import { EmptyState, Modal, Skeleton, useToast } from '../components/ui';
import { BackButton } from '../components/BackButton';

type Approval = { collection: Collection; operator: string; current: boolean };
const WETH = (import.meta.env.VITE_WETH_ADDRESS || '0x4200000000000000000000000000000000000006') as Address;

async function limit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

export default function Security() {
  const { t } = useI18n();
  const cfg = useAppConfig();
  const toast = useToast();
  const qc = useQueryClient();
  const { address } = useAccount();
  const { openConnect } = useWalletUI();
  const { signMessageAsync } = useSignMessage();
  const ctx = (): ActionCtx => ({ cfg, address: address as Address, signMessage: (message) => signMessageAsync({ message }), progress: () => {} });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const me = address?.toLowerCase();
  const market = cfg.market?.toLowerCase() || null;
  const operators = [...new Set([market, ...(cfg.legacyMarkets || [])].filter(Boolean) as string[])];
  const pinnedOk = (!PINNED.market || PINNED.market === market) && (!PINNED.chainId || (PINNED.chainId === activeChain.id && cfg.chainId === PINNED.chainId));

  const scan = useQuery({
    queryKey: ['security', me, operators.join(',')],
    enabled: !!me && operators.length > 0,
    queryFn: async () => {
      // Every collection the marketplace knows plus every collection you hold.
      const [cols, mine] = await Promise.all([
        api.get<{ collections: Collection[] }>('/collections', { limit: 100, sort: 'new' }).catch(() => ({ collections: [] as Collection[] })),
        api.get<{ tokens: (Token & { collection_name?: string; collection_slug?: string })[] }>(`/users/${me}/tokens`, { limit: 100 }).catch(() => ({ tokens: [] as Token[] })),
      ]);
      const byAddr = new Map(cols.collections.map((c) => [c.address.toLowerCase(), c]));
      for (const tk of mine.tokens as (Token & { collection_name?: string; collection_slug?: string })[]) {
        const a = tk.collection.toLowerCase();
        if (!byAddr.has(a)) byAddr.set(a, { address: a, name: tk.collection_name || short(a), slug: tk.collection_slug || a, art_style: tk.art_style || 'tile' } as Collection);
      }
      const pairs = [...byAddr.values()].flatMap((c) => operators.map((op) => ({ c, op })));
      const approved = await limit(pairs, 8, async ({ c, op }) =>
        readContract(wagmiConfig, { address: c.address as Address, abi: collectionAbi, functionName: 'isApprovedForAll', args: [me as Address, op as Address], chainId: activeChain.id })
          .then(Boolean).catch(() => false));
      const approvals: Approval[] = pairs.filter((_, i) => approved[i]).map(({ c, op }) => ({ collection: c, operator: op, current: op === market }));
      const allowances = await Promise.all(operators.map(async (op) => ({
        operator: op, current: op === market,
        amount: await readContract(wagmiConfig, { address: WETH, abi: wethAbi, functionName: 'allowance', args: [me as Address, op as Address], chainId: activeChain.id }).catch(() => 0n) as bigint,
      })));
      return { approvals, allowances: allowances.filter((a) => a.amount > 0n) };
    },
  });

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await fn();
      toast(done);
      await qc.invalidateQueries({ queryKey: ['security'] });
    } catch (e) {
      toast(errorMessage(e, t), 'error');
    } finally {
      setBusy(null);
    }
  }
  const revokeNft = (a: Approval) => act(`nft:${a.collection.address}:${a.operator}`, () => revokeNftApproval(ctx(), a.collection.address, a.operator), t('sec.revoked'));
  const revokeAllowance = (op: string) => act(`weth:${op}`, () => revokeWeth(ctx(), op), t('sec.revoked'));

  if (!address) {
    return (
      <div className="page container sec">
        <div className="back-row"><BackButton /></div>
        <EmptyState icon={<IconLock size={28} />} title={t('sec.connect')} action={<button className="btn" onClick={openConnect}>{t('wallet.connect')}</button>} />
      </div>
    );
  }
  const data = scan.data;
  const old = data?.approvals.filter((a) => !a.current) ?? [];
  const cur = data?.approvals.filter((a) => a.current) ?? [];

  return (
    <div className="page container sec">
      <div className="back-row"><BackButton /></div>
      <header className="sec__head">
        <span className="sec__badge"><IconLock size={22} /></span>
        <div>
          <h1 className="h1">{t('sec.title')}</h1>
          <p className="soft">{t('sec.sub')}</p>
        </div>
      </header>

      <div className="sec__grid">
        <section className="card-v3 sec__how">
          <h2 className="card-v3__title">{t('sec.howTitle')}</h2>
          <ul className="sec__list">
            {(['sec.how1', 'sec.how2', 'sec.how3', 'sec.how4', 'sec.how5'] as const).map((k) => <li key={k}><IconCheck size={15} /><span>{t(k)}</span></li>)}
          </ul>
        </section>

        <section className="card-v3">
          <h2 className="card-v3__title">{t('sec.contracts')}</h2>
          <div className="sec__contract">
            <div>
              <div className="strong">{t('sec.currentMarket')}</div>
              <a className="link mono-num small" href={`${cfg.explorerUrl}/address/${market}`} target="_blank" rel="noreferrer">{market} <IconExternal size={12} /></a>
            </div>
            <span className={`pill ${pinnedOk ? 'sec__ok' : 'sec__bad'}`}>{pinnedOk ? <><IconCheck size={13} />{PINNED.market ? t('sec.pinned') : t('sec.active')}</> : <><IconAlert size={13} />{t('sec.mismatch')}</>}</span>
          </div>
          {(cfg.legacyMarkets || []).map((m) => (
            <div className="sec__contract" key={m}>
              <div>
                <div className="strong">{t('sec.oldMarket')}</div>
                <a className="link mono-num small" href={`${cfg.explorerUrl}/address/${m}`} target="_blank" rel="noreferrer">{m} <IconExternal size={12} /></a>
              </div>
              <span className="pill pill--outline">{t('sec.paused')}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card-v3">
        <header className="card-v3__head">
          <h2 className="card-v3__title">{t('sec.approvals')}</h2>
          <button className="btn btn--outline btn--sm" onClick={() => scan.refetch()} disabled={scan.isFetching}>{scan.isFetching && <span className="spinner" style={{ width: 12, height: 12 }} />}{t('sec.rescan')}</button>
        </header>
        <p className="small soft" style={{ margin: 0 }}>{t('sec.approvalsSub')}</p>
        {scan.isLoading ? <Skeleton h={120} r={12} /> : (
          <>
            {old.length > 0 && <div className="notice notice--warn"><IconAlert size={16} /><span>{t('sec.oldWarn', { n: old.length })}</span></div>}
            {!old.length && !cur.length && <div className="sec__empty small muted"><IconCheck size={15} /> {t('sec.noApprovals')}</div>}
            <div className="sec__rows">
              {[...old, ...cur].map((a) => {
                const id = `nft:${a.collection.address}:${a.operator}`;
                return (
                  <div className="sec__row" key={id}>
                    <span className="sec__avatar"><CollectionAvatar collection={a.collection} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="strong ellipsis">{a.collection.name}</div>
                      <div className="tiny muted">{a.current ? t('sec.byCurrent') : t('sec.byOld')} · {short(a.operator)}</div>
                    </div>
                    {!a.current ? <span className="pill sec__bad">{t('sec.remove')}</span> : <span className="tiny muted hide-sm">{t('sec.neededToSell')}</span>}
                    <button className={`btn btn--sm ${a.current ? 'btn--outline' : ''}`} disabled={!!busy} onClick={() => revokeNft(a)}>
                      {busy === id && <span className="spinner" style={{ width: 12, height: 12 }} />}{t('sec.revoke')}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="card-v3">
        <h2 className="card-v3__title">{t('sec.weth')}</h2>
        <p className="small soft" style={{ margin: 0 }}>{t('sec.wethSub')}</p>
        {scan.isLoading ? <Skeleton h={60} r={12} /> : !data?.allowances.length ? (
          <div className="sec__empty small muted"><IconCheck size={15} /> {t('sec.noWeth')}</div>
        ) : (
          <div className="sec__rows">
            {data.allowances.map((a) => (
              <div className="sec__row" key={a.operator}>
                <span className="sec__avatar sec__avatar--weth">W</span>
                <div style={{ minWidth: 0 }}>
                  <div className="strong mono-num">{a.amount > 10n ** 30n ? t('sec.unlimited') : `${eth(a.amount)} WETH`}</div>
                  <div className="tiny muted">{a.current ? t('sec.byCurrent') : t('sec.byOld')} · {short(a.operator)}</div>
                </div>
                {!a.current && <span className="pill sec__bad">{t('sec.remove')}</span>}
                <button className="btn btn--sm btn--outline" disabled={!!busy} onClick={() => revokeAllowance(a.operator)}>
                  {busy === `weth:${a.operator}` && <span className="spinner" style={{ width: 12, height: 12 }} />}{t('sec.revoke')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card-v3 sec__danger">
        <h2 className="card-v3__title">{t('sec.emergency')}</h2>
        <p className="small soft" style={{ margin: 0 }}>{t('sec.emergencySub')}</p>
        <button className="btn" style={{ justifySelf: 'start' }} onClick={() => setConfirmAll(true)}>{t('sec.cancelAll')}</button>
      </section>

      <section className="card-v3">
        <h2 className="card-v3__title">{t('sec.tipsTitle')}</h2>
        <ul className="sec__list sec__list--tips">
          {(['sec.tip1', 'sec.tip2', 'sec.tip3', 'sec.tip4', 'sec.tip5'] as const).map((k) => <li key={k}><IconAlert size={15} /><span>{t(k)}</span></li>)}
        </ul>
        <Link className="link small" to="/support">{t('sec.report')}</Link>
      </section>

      {confirmAll && (
        <Modal open onClose={() => setConfirmAll(false)} title={t('sec.cancelAll')} locked={!!busy}>
          <p className="soft">{t('sec.cancelAllBody')}</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setConfirmAll(false)} disabled={!!busy}>{t('common.close')}</button>
            <button className="btn" style={{ flex: 1 }} disabled={!!busy} onClick={() => act('all', () => cancelAllOrders(ctx()), t('sec.cancelledAll')).then(() => setConfirmAll(false))}>
              {busy === 'all' && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('sec.cancelAllBtn')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
