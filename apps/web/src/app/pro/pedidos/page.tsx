'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ProviderInboxNotifications } from '@/components/provider/provider-inbox-notifications';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { buildProviderInboxModel } from '@/lib/provider-inbox';
import {
  declineRequestInvitation,
  listMyRequestInvitations,
  listMyProviderProposals,
  listOpenServiceRequests,
  ProviderProposalFeedItem,
  ProviderRequestInvitation,
  ServiceRequest,
  submitProposal,
} from '@/lib/service-requests';

const invitationStatusLabel: Record<string, string> = {
  SENT: 'Convite enviado',
  ACCEPTED: 'Aceite',
  DECLINED: 'Recusado',
  EXPIRED: 'Expirado',
};

function getInvitationTone(status: string) {
  if (status === 'ACCEPTED') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (status === 'DECLINED') {
    return 'bg-rose-100 text-rose-700 border-rose-200';
  }

  if (status === 'EXPIRED') {
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  return 'bg-blue-100 text-blue-700 border-blue-200';
}

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProviderRequestsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [invitations, setInvitations] = useState<ProviderRequestInvitation[]>([]);
  const [proposals, setProposals] = useState<ProviderProposalFeedItem[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [priceInputByRequest, setPriceInputByRequest] = useState<
    Record<string, string>
  >({});
  const [commentInputByRequest, setCommentInputByRequest] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [decliningInvitationId, setDecliningInvitationId] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState('A carregar pedidos disponíveis...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar pedidos disponíveis...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setRequests([]);
            setAccessToken(null);
          }
          return;
        }

        const token = session.auth.accessToken;
        const [response, nextInvitations, nextProposals] = await Promise.all([
          listOpenServiceRequests(token, {
            status: 'OPEN',
            page: 1,
            limit: 30,
          }),
          listMyRequestInvitations(token),
          listMyProviderProposals(token),
        ]);

        if (!active) {
          return;
        }

        const inbox = buildProviderInboxModel({
          requests: response.data,
          invitations: nextInvitations,
          proposals: nextProposals,
        });

        setAccessToken(token);
        setRequests(response.data);
        setInvitations(nextInvitations);
        setProposals(nextProposals);
        setStatus(
          inbox.pendingInvitations.length > 0 || inbox.openMarketRequests.length > 0
            ? `${inbox.pendingInvitations.length} convite(s) e ${inbox.openMarketRequests.length} pedido(s) no mercado aberto.`
            : 'Sem novas oportunidades neste momento.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar pedidos.'));
          setRequests([]);
          setInvitations([]);
          setProposals([]);
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

  async function reloadRequests() {
    if (!accessToken) {
      return;
    }

    const [response, nextInvitations, nextProposals] = await Promise.all([
      listOpenServiceRequests(accessToken, {
        status: 'OPEN',
        page: 1,
        limit: 30,
      }),
      listMyRequestInvitations(accessToken),
      listMyProviderProposals(accessToken),
    ]);

    setRequests(response.data);
    setInvitations(nextInvitations);
    setProposals(nextProposals);
  }

  async function handleSubmitProposal(requestId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const parsedPrice = Number(priceInputByRequest[requestId] ?? '0');
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setStatus('Define um preço válido para enviar proposta.');
      return;
    }

    setSaving(true);
    setStatus('A enviar proposta...');

    try {
      await submitProposal(accessToken, requestId, {
        price: Math.trunc(parsedPrice),
        comment: commentInputByRequest[requestId]?.trim() || undefined,
      });

      setStatus('Proposta enviada com sucesso.');
      setExpandedRequestId(null);
      await reloadRequests();
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao enviar proposta.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setDecliningInvitationId(invitationId);
    setStatus('A recusar convite...');

    try {
      await declineRequestInvitation(accessToken, invitationId);
      setStatus('Convite recusado.');
      await reloadRequests();
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao recusar convite.'));
    } finally {
      setDecliningInvitationId(null);
    }
  }

  const inbox = useMemo(
    () =>
      buildProviderInboxModel({
        requests,
        invitations,
        proposals,
      }),
    [invitations, proposals, requests],
  );

  function renderProposalComposer(requestId: string) {
    return (
      <div className='mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3'>
        <label className='block space-y-1 text-sm text-slate-700'>
          <span>Preço (MZN)</span>
          <input
            type='number'
            min={1}
            value={priceInputByRequest[requestId] ?? ''}
            onChange={(event) =>
              setPriceInputByRequest((current) => ({
                ...current,
                [requestId]: event.target.value,
              }))
            }
            className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
          />
        </label>

        <label className='block space-y-1 text-sm text-slate-700'>
          <span>Comentário</span>
          <textarea
            value={commentInputByRequest[requestId] ?? ''}
            onChange={(event) =>
              setCommentInputByRequest((current) => ({
                ...current,
                [requestId]: event.target.value,
              }))
            }
            maxLength={320}
            className='min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
          />
        </label>

        <button
          type='button'
          className='inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
          onClick={() => {
            void handleSubmitProposal(requestId);
          }}
          disabled={saving}
        >
          {saving ? 'A enviar...' : 'Confirmar proposta'}
        </button>
      </div>
    );
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>
              Inbox do prestador
            </h1>
            <p className='mt-1 text-sm text-slate-600'>
              Vê primeiro convites diretos, depois pedidos do mercado aberto e o
              estado das tuas propostas.
            </p>
          </div>
          <Link
            href='/pro/propostas'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Ver propostas
          </Link>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Mercado aberto
            </p>
            <p className='mt-1 text-lg font-semibold text-slate-900'>
              {inbox.openMarketRequests.length}
            </p>
          </article>
          <article className='rounded-xl border border-emerald-200 bg-emerald-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-emerald-700'>
              Convites pendentes
            </p>
            <p className='mt-1 text-lg font-semibold text-emerald-700'>
              {inbox.pendingInvitations.length}
            </p>
          </article>
          <article className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-blue-700'>
              Em análise
            </p>
            <p className='mt-1 text-lg font-semibold text-blue-700'>
              {inbox.awaitingProposals.length}
            </p>
          </article>
          <article className='rounded-xl border border-purple-200 bg-purple-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-purple-700'>
              Selecionadas
            </p>
            <p className='mt-1 text-lg font-semibold text-purple-700'>
              {inbox.selectedProposals.length}
            </p>
          </article>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <ProviderInboxNotifications
        title='Atualizações importantes'
        subtitle='Eventos que pedem atenção agora e oportunidades que merecem resposta.'
        items={inbox.notifications.filter(
          (item) => item.kind !== 'rejected_proposals',
        )}
        emptyLabel='Sem alertas novos. Quando houver convites, propostas selecionadas ou pedidos relevantes, eles aparecem aqui.'
      />

      {invitations.length > 0 ? (
        <section
          id='convites'
          className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
        >
          <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-slate-900'>
                Convites para proposta
              </h2>
              <p className='mt-1 text-sm text-slate-600'>
                Pedidos em que o cliente pediu diretamente a tua proposta, separados
                do mercado aberto.
              </p>
            </div>
            <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'>
              {invitations.length} convite(s)
            </span>
          </div>

          <div className='mt-4 space-y-3'>
            {invitations.map((invitation) => {
              const ownProposal = invitation.request.proposals?.[0] ?? null;
              const isPending = invitation.status === 'SENT';
              const requestStillOpen = invitation.request.status === 'OPEN';

              return (
                <article
                  key={invitation.id}
                  className='rounded-2xl border border-slate-200 bg-slate-50 p-4'
                >
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-2'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='text-base font-semibold text-slate-900'>
                          {invitation.request.title}
                        </h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getInvitationTone(invitation.status)}`}
                        >
                          {invitationStatusLabel[invitation.status] ?? invitation.status}
                        </span>
                      </div>

                      <p className='text-sm text-slate-600'>
                        {invitation.request.description.length > 180
                          ? `${invitation.request.description.slice(0, 180)}...`
                          : invitation.request.description}
                      </p>

                      <div className='text-xs text-slate-500'>
                        <p>Local: {invitation.request.location ?? 'n/d'}</p>
                        <p>
                          Categoria:{' '}
                          {invitation.request.category?.name ??
                            invitation.request.categoryId}
                        </p>
                      </div>

                      {ownProposal ? (
                        <p className='text-xs text-emerald-700'>
                          Tua proposta: {formatCurrencyMzn(ownProposal.price)} (
                          {ownProposal.status})
                        </p>
                      ) : null}
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                      {requestStillOpen ? (
                        <button
                          type='button'
                          className='inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                          onClick={() =>
                            setExpandedRequestId((current) =>
                              current === invitation.request.id
                                ? null
                                : invitation.request.id,
                            )
                          }
                        >
                          {ownProposal ? 'Atualizar proposta' : 'Enviar proposta'}
                        </button>
                      ) : (
                        <span className='text-xs text-slate-500'>
                          Pedido já não está aberto para novas ações.
                        </span>
                      )}
                      {isPending ? (
                        <button
                          type='button'
                          className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                          onClick={() => {
                            void handleDeclineInvitation(invitation.id);
                          }}
                          disabled={decliningInvitationId === invitation.id}
                        >
                          {decliningInvitationId === invitation.id
                            ? 'A recusar...'
                            : 'Recusar convite'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {requestStillOpen && expandedRequestId === invitation.request.id
                    ? renderProposalComposer(invitation.request.id)
                    : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        id='mercado'
        className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
      >
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-slate-900'>Mercado aberto</h2>
            <p className='mt-1 text-sm text-slate-600'>
              Pedidos públicos sem convite direto e ainda sem tua proposta.
            </p>
          </div>
          <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'>
            {inbox.openMarketRequests.length} pedido(s)
          </span>
        </div>

        {inbox.openMarketRequests.length === 0 ? (
          <div className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600'>
            Sem pedidos novos no mercado aberto neste momento.
          </div>
        ) : (
          <div className='mt-4 space-y-3'>
            {inbox.openMarketRequests.map((request) => {
              const isExpanded = expandedRequestId === request.id;

              return (
                <article
                  key={request.id}
                  id={`provider-request-${request.id}`}
                  className='rounded-2xl border border-slate-200 bg-slate-50 p-4'
                >
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-2'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='text-base font-semibold text-slate-900'>
                          {request.title}
                        </h3>
                        <span className='rounded-full border border-blue-200 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700'>
                          Mercado aberto
                        </span>
                      </div>
                      <p className='text-sm text-slate-600'>
                        {request.description.length > 180
                          ? `${request.description.slice(0, 180)}...`
                          : request.description}
                      </p>
                      <div className='text-xs text-slate-500'>
                        <p>Local: {request.location ?? 'n/d'}</p>
                        <p>Categoria: {request.category?.name ?? request.categoryId}</p>
                      </div>
                      <p className='text-xs text-blue-700'>Ainda sem tua proposta.</p>
                    </div>

                    <button
                      type='button'
                      className='inline-flex shrink-0 items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700'
                      onClick={() =>
                        setExpandedRequestId((current) =>
                          current === request.id ? null : request.id,
                        )
                      }
                    >
                      {isExpanded ? 'Fechar' : 'Enviar proposta'}
                    </button>
                  </div>

                  {isExpanded ? renderProposalComposer(request.id) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
