import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useI18n } from '../i18n';
import type { DictKey } from '../i18n/en';
import { dateTime, timeAgo } from '../lib/format';
import { useAuthedApi } from '../lib/tx';
import { EmptyState, Skeleton, useToast } from '../components/ui';
import { useWalletUI } from '../components/wallet';

const CATS = ['general', 'mint', 'trade', 'listing', 'offer', 'collection', 'wallet', 'bug', 'report', 'other'] as const;
type Ticket = { id: string; ref: string; category: string; subject: string; status: string; created_at: string; last_message_at: string };
type Msg = { id: number; is_staff: boolean; body: string; created_at: string };

export default function Support() {
  const { t } = useI18n();
  const { address } = useAccount();
  const { openConnect } = useWalletUI();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="page container">
      <div className="page-head">
        <h1 className="h1">{t('support.title')}</h1>
        <p className="lead">{t('support.sub')}</p>
      </div>
      {!address ? (
        <EmptyState title={t('support.connect')} action={<button className="btn" onClick={openConnect}>{t('wallet.connect')}</button>} />
      ) : (
        <div className="panel-layout" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
          <NewTicket onCreated={setOpen} />
          <div style={{ display: 'grid', gap: 16 }}>{open ? <TicketView id={open} onBack={() => setOpen(null)} /> : <MyTickets onOpen={setOpen} />}</div>
        </div>
      )}
    </div>
  );
}

function NewTicket({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const authed = useAuthedApi();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const pre = params.get('category');
  const [f, setF] = useState({
    category: CATS.includes(pre as any) ? String(pre) : 'general',
    subject: params.get('collection') ? `Report ${params.get('collection')}` : '',
    message: '', contact: '', txHash: '',
  });
  const [busy, setBusy] = useState(false);
  const ok = f.subject.trim().length >= 3 && f.message.trim().length >= 10;
  async function send() {
    setBusy(true);
    try {
      const r = await authed.post<{ ticket: { id: string; ref: string } }>('/support', { ...f, txHash: f.txHash || undefined });
      toast(t('support.sent', { ref: r.ticket.ref }));
      setF({ category: 'general', subject: '', message: '', contact: '', txHash: '' });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      onCreated(r.ticket.id);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card card--pad" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
      <h2 className="h3">{t('support.new')}</h2>
      <div className="field"><label>{t('support.category')}</label>
        <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {CATS.map((c) => <option key={c} value={c}>{t(`support.cat.${c}` as DictKey)}</option>)}
        </select>
      </div>
      <div className="field"><label>{t('support.subject')}</label><input className="input" maxLength={140} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
      <div className="field"><label>{t('support.message')}</label><textarea className="textarea" maxLength={4000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
      <div className="field"><label>{t('support.tx')}</label><input className="input" value={f.txHash} onChange={(e) => setF({ ...f, txHash: e.target.value.trim() })} placeholder="0x..." /></div>
      <div className="field"><label>{t('support.contact')}</label><input className="input" maxLength={200} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
      <button className="btn" disabled={!ok || busy} onClick={send}>{busy && <span className="spinner" />}{t('support.send')}</button>
    </div>
  );
}

function MyTickets({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, lang } = useI18n();
  const authed = useAuthedApi();
  const { address } = useAccount();
  const q = useQuery({ queryKey: ['tickets', address], queryFn: () => authed.get<{ tickets: Ticket[] }>('/support/mine') });
  if (q.isLoading) return <Skeleton h={200} r={14} />;
  const list = q.data?.tickets ?? [];
  return (
    <div className="panel">
      <div className="panel__head">{t('support.mine')}</div>
      {list.length === 0 ? <div className="panel__body muted">{t('support.empty')}</div> : list.map((x) => (
        <button key={x.id} className="row" onClick={() => onOpen(x.id)} style={{ width: '100%', padding: '12px 18px', border: 0, borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="strong" style={{ display: 'block' }}>{x.subject}</span>
            <span className="tiny muted row" style={{ gap: 10 }}><span>{x.ref}</span><span>{timeAgo(x.last_message_at, lang)}</span></span>
          </span>
          <span className="pill">{t(`support.status.${x.status}` as DictKey)}</span>
        </button>
      ))}
    </div>
  );
}

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const authed = useAuthedApi();
  const [reply, setReply] = useState('');
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => authed.get<{ ticket: Ticket; messages: Msg[] }>(`/support/${id}`), refetchInterval: 20_000 });
  async function send() {
    try {
      await authed.post(`/support/${id}/reply`, { body: reply });
      setReply('');
      q.refetch();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }
  if (!q.data) return <Skeleton h={240} r={14} />;
  const { ticket, messages } = q.data;
  return (
    <div className="card card--pad" style={{ display: 'grid', gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>{t('create.back')}</button>
        <span className="pill">{t(`support.status.${ticket.status}` as DictKey)}</span>
      </div>
      <div><div className="tiny muted">{ticket.ref}</div><h2 className="h3">{ticket.subject}</h2></div>
      <div className="thread">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.is_staff ? 'is-staff' : ''}`}>
            <div className="tiny" style={{ opacity: 0.7, marginBottom: 4 }}>{m.is_staff ? t('support.staff') : t('common.you')}, {dateTime(m.created_at, lang)}</div>
            {m.body}
          </div>
        ))}
      </div>
      {ticket.status !== 'closed' && (
        <>
          <textarea className="textarea" value={reply} maxLength={4000} onChange={(e) => setReply(e.target.value)} />
          <button className="btn" style={{ justifySelf: 'start' }} disabled={!reply.trim()} onClick={send}>{t('support.reply')}</button>
        </>
      )}
    </div>
  );
}
