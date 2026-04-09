'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProviderInboxNotifications } from '@/components/provider/provider-inbox-notifications';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  listMyNotifications,
  markAllNotificationsRead,
} from '@/lib/notifications';
import type { InboxNotification } from '@/lib/notifications';
import { buildProviderInboxModel } from '@/lib/provider-inbox';
import {
  listMyProviderProposals,
  ProviderProposalFeedItem,
} from '@/lib/service-requests';

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function proposalStatusLabel(status: string): string {
  if (status === 'SELECTED') {
    return 'Selecionada';
  }

  if (status === 'REJECTED') {
    return 'Não selecionada';
  }

  return 'Em análise';
}

function proposalStatusClass(status: string): string {
  if (status === 'SELECTED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'REJECTED') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-blue-100 text-blue-700';
}

function proposalOriginLabel(item: ProviderProposalFeedItem): string {
  return item.request.invitation ? 'Convite direto' : 'Mercado aberto';
}

function proposalOriginClass(item: ProviderProposalFeedItem): string {
  return item.request.invitation
    ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
    : 'border-slate-200 bg-slate-100 text-slate-700';
}

export default function ProviderProposalsPage() {
  const [proposals, setProposals] = useState<ProviderProposalFeedItem[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [status, setStatus] = useState('A carregar propostas...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar propostas...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setProposals([]);
          }
          return;
        }

        const token = session.auth.accessToken;
        const [nextProposals, nextNotifications] = await Promise.all([
          listMyProviderProposals(token),
          listMyNotifications(token, {
            page: 1,
            limit: 12,
          }),
        ]);

        if (!active) {
          return;
        }

        setAccessToken(token);
        setProposals(nextProposals);
        setNotifications(nextNotifications.data);
        setNotificationUnreadCount(nextNotifications.unreadCount);
        const inbox = buildProviderInboxModel({
          requests: [],
          invitations: [],
          proposals: nextProposals,
        });
        const total =
          inbox.awaitingProposals.length +
          inbox.selectedProposals.length +
          inbox.rejectedProposals.length;

        setStatus(
          total > 0
            ? `Encontradas ${total} proposta(s) enviadas.`
            : 'Ainda não tens propostas registadas.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar propostas.'));
          setProposals([]);
          setNotifications([]);
          setNotificationUnreadCount(0);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const inbox = useMemo(
    () =>
      buildProviderInboxModel({
        requests: [],
        invitations: [],
        proposals,
      }),
    [proposals],
  );
  const persistedNotifications = useMemo(
    () =>
      notifications.filter(
        (item) =>
          item.kind === 'PROPOSAL_SELECTED' ||
          item.kind === 'PROPOSAL_REJECTED' ||
          item.kind === 'JOB_MESSAGE_RECEIVED',
      ),
    [notifications],
  );
  const total = useMemo(() => proposals.length, [proposals]);

  async function handleMarkAllNotificationsRead() {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setMarkingNotificationsRead(true);

    try {
      await markAllNotificationsRead(accessToken);
      const nextNotifications = await listMyNotifications(accessToken, {
        page: 1,
        limit: 12,
      });
      setNotifications(nextNotifications.data);
      setNotificationUnreadCount(nextNotifications.unreadCount);
      setStatus('Notificações marcadas como lidas.');
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, 'Falha ao atualizar notificações.'),
      );
    } finally {
      setMarkingNotificationsRead(false);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>
              Propostas enviadas
            </h1>
            <p className='mt-1 text-sm text-slate-600'>
              Acompanha o que foi enviado por convite direto e por mercado aberto,
              e vê rapidamente o que mudou.
            </p>
          </div>
          <Link
            href='/pro/pedidos'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Voltar aos pedidos
          </Link>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <article className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-blue-700'>
              Em análise
            </p>
            <p className='mt-1 text-lg font-semibold text-blue-700'>
              {inbox.awaitingProposals.length}
            </p>
          </article>
          <article className='rounded-xl border border-emerald-200 bg-emerald-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-emerald-700'>
              Selecionadas
            </p>
            <p className='mt-1 text-lg font-semibold text-emerald-700'>
              {inbox.selectedProposals.length}
            </p>
          </article>
          <article className='rounded-xl border border-rose-200 bg-rose-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-rose-700'>
              Não selecionadas
            </p>
            <p className='mt-1 text-lg font-semibold text-rose-700'>
              {inbox.rejectedProposals.length}
            </p>
          </article>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Via convite
            </p>
            <p className='mt-1 text-lg font-semibold text-slate-900'>
              {inbox.directInviteProposals.length}
            </p>
          </article>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
          {total > 0 ? ` (${total} total)` : ''}
        </p>
      </section>

      <ProviderInboxNotifications
        title='Notificações da inbox'
        subtitle='Estas notificações já são persistidas e mantêm histórico de leitura.'
        items={persistedNotifications}
        emptyLabel='Sem atualizações novas na tua inbox persistida.'
        action={
          notificationUnreadCount > 0 ? (
            <button
              type='button'
              className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
              onClick={() => {
                void handleMarkAllNotificationsRead();
              }}
              disabled={markingNotificationsRead}
            >
              {markingNotificationsRead
                ? 'A atualizar...'
                : `Marcar ${notificationUnreadCount} como lidas`}
            </button>
          ) : null
        }
      />

      <ProposalSection
        id='aguardando'
        title='Em análise'
        subtitle='Propostas em análise pelo cliente.'
        emptyLabel='Sem propostas aguardando.'
        items={inbox.awaitingProposals}
      />

      <ProposalSection
        id='selecionadas'
        title='Selecionadas'
        subtitle='Propostas escolhidas e potencialmente já convertidas em job.'
        emptyLabel='Sem propostas selecionadas.'
        items={inbox.selectedProposals}
      />

      <ProposalSection
        id='nao-selecionadas'
        title='Não selecionadas'
        subtitle='Propostas não selecionadas.'
        emptyLabel='Sem propostas rejeitadas.'
        items={inbox.rejectedProposals}
      />
    </main>
  );
}

function ProposalSection(input: {
  id: string;
  title: string;
  subtitle: string;
  emptyLabel: string;
  items: ProviderProposalFeedItem[];
}) {
  return (
    <section
      id={input.id}
      className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
    >
      <h2 className='text-lg font-semibold text-slate-900'>{input.title}</h2>
      <p className='mt-1 text-sm text-slate-600'>{input.subtitle}</p>

      {input.items.length === 0 ? (
        <p className='mt-3 text-sm text-slate-500'>{input.emptyLabel}</p>
      ) : (
        <div className='mt-3 space-y-3'>
          {input.items.map((item) => (
            <article
              key={item.id}
              className='rounded-xl border border-slate-200 bg-slate-50 p-3'
            >
              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-1 text-sm text-slate-700'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='font-semibold text-slate-900'>{item.request.title}</p>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${proposalOriginClass(item)}`}
                    >
                      {proposalOriginLabel(item)}
                    </span>
                  </div>
                  <p>
                    <strong>Preço:</strong> {formatCurrencyMzn(item.price)}
                  </p>
                  <p>
                    <strong>Comentário:</strong> {item.comment ?? 'Sem comentário'}
                  </p>
                  <p className='text-xs text-slate-500'>
                    {item.request.category?.name
                      ? `${item.request.category.name} · `
                      : ''}
                    {item.request.location ?? 'Local n/d'}
                  </p>
                  <p className='text-xs text-slate-500'>
                    Pedido: {item.request.status}
                  </p>
                  <p className='text-xs text-slate-500'>
                    Atualizada em {new Date(item.updatedAt).toLocaleString('pt-PT')}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${proposalStatusClass(
                    item.status,
                  )}`}
                >
                  {proposalStatusLabel(item.status)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
