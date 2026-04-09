'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { JobProtectionPanel } from '@/components/payments/job-protection-panel';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  appealTrustSafetyIntervention,
  getJobConversation,
  listMyMessageConversations,
  markJobConversationRead,
  sendJobMessage,
} from '@/lib/messages';
import type {
  JobConversation,
  MessageConversationSummary,
  TrustSafetyIntervention,
} from '@/lib/messages';
import { getJobFinancialState, JobFinancialState } from '@/lib/payments';

function formatConversationStatus(status: string) {
  if (status === 'REQUESTED') {
    return 'Pedido criado';
  }

  if (status === 'ACCEPTED') {
    return 'Aceite';
  }

  if (status === 'IN_PROGRESS') {
    return 'Em execução';
  }

  if (status === 'COMPLETED') {
    return 'Concluído';
  }

  if (status === 'CANCELED') {
    return 'Cancelado';
  }

  return status;
}

function statusClass(status: string) {
  if (status === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'CANCELED') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'IN_PROGRESS') {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-amber-100 text-amber-700';
}

function interventionStatusLabel(status: string) {
  if (status === 'LOGGED') {
    return 'Aviso registado';
  }

  if (status === 'OPEN') {
    return 'Em revisão';
  }

  if (status === 'APPEALED') {
    return 'Em apelação';
  }

  if (status === 'CLEARED') {
    return 'Liberado';
  }

  if (status === 'ENFORCED') {
    return 'Restrição confirmada';
  }

  return status;
}

function interventionStatusClass(status: string) {
  if (status === 'CLEARED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'ENFORCED') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'OPEN' || status === 'APPEALED') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-700';
}

export function JobMessagesWorkspace(input: {
  basePath: string;
  title: string;
  description: string;
  homeHref: string;
  homeLabel: string;
  viewerRole: 'customer' | 'provider';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedJobId = searchParams.get('job');

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<MessageConversationSummary[]>(
    [],
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [thread, setThread] = useState<JobConversation | null>(null);
  const [financial, setFinancial] = useState<JobFinancialState | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [appealing, setAppealing] = useState(false);
  const [moderationNotice, setModerationNotice] = useState<{
    title: string;
    description: string;
    ctaHref: string;
    ctaLabel: string;
    appealAllowed: boolean;
    interventionId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('A carregar conversas...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar conversas...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setAccessToken(null);
            setViewerUserId(null);
            setConversations([]);
            setStatus('Sessão inválida. Faz login novamente.');
          }
          return;
        }

        const nextConversations = await listMyMessageConversations(
          session.auth.accessToken,
        );

        if (!active) {
          return;
        }

        setAccessToken(session.auth.accessToken);
        setViewerUserId(session.auth.user.id);
        setConversations(nextConversations);
        setStatus(
          nextConversations.length > 0
            ? `${nextConversations.length} conversa(s) disponível(is).`
            : 'Ainda não tens conversas ligadas a jobs.',
        );
      } catch (error) {
        if (active) {
          setConversations([]);
          setStatus(humanizeUnknownError(error, 'Falha ao carregar conversas.'));
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

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedJobId(null);
      setThread(null);
      setFinancial(null);
      setModerationNotice(null);
      return;
    }

    const nextSelected =
      (requestedJobId &&
      conversations.some((conversation) => conversation.jobId === requestedJobId)
        ? requestedJobId
        : null) ??
      (selectedJobId &&
      conversations.some((conversation) => conversation.jobId === selectedJobId)
        ? selectedJobId
        : conversations[0].jobId);

    if (nextSelected && nextSelected !== selectedJobId) {
      setSelectedJobId(nextSelected);
    }
  }, [conversations, requestedJobId, selectedJobId]);

  useEffect(() => {
    let active = true;

    async function loadThread(jobId: string) {
      if (!accessToken) {
        return;
      }

      setThreadLoading(true);

      try {
        const [nextThread, , nextFinancial] = await Promise.all([
          getJobConversation(accessToken, jobId),
          markJobConversationRead(accessToken, jobId),
          getJobFinancialState(accessToken, jobId),
        ]);

        if (!active) {
          return;
        }

        setThread(nextThread);
        setFinancial(nextFinancial);
        setModerationNotice(null);

        const nextConversations = await listMyMessageConversations(accessToken);
        if (!active) {
          return;
        }

        setConversations(nextConversations);
      } catch (error) {
        if (active) {
          setThread(null);
          setFinancial(null);
          setStatus(humanizeUnknownError(error, 'Falha ao carregar conversa.'));
        }
      } finally {
        if (active) {
          setThreadLoading(false);
        }
      }
    }

    if (selectedJobId) {
      void loadThread(selectedJobId);
    }

    return () => {
      active = false;
    };
  }, [accessToken, selectedJobId]);

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.jobId === selectedJobId) ??
      null,
    [conversations, selectedJobId],
  );

  async function refreshSelectedWorkspace(jobId: string) {
    if (!accessToken) {
      return;
    }

    const [nextThread, nextFinancial, nextConversations] = await Promise.all([
      getJobConversation(accessToken, jobId),
      getJobFinancialState(accessToken, jobId),
      listMyMessageConversations(accessToken),
    ]);

    setThread(nextThread);
    setFinancial(nextFinancial);
    setConversations(nextConversations);
  }

  async function handleSendMessage() {
    if (!accessToken || !selectedJobId) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const content = messageInput.trim();
    if (content.length === 0) {
      setStatus('Escreve uma mensagem antes de enviar.');
      return;
    }

    setSending(true);
    setStatus('A enviar mensagem...');

    try {
      const result = await sendJobMessage(accessToken, selectedJobId, { content });

      if (result.status === 'sent') {
        setMessageInput('');
        setModerationNotice(null);
        await refreshSelectedWorkspace(selectedJobId);
        setStatus('Mensagem enviada.');
        return;
      }

      setModerationNotice({
        title: result.guidance.title,
        description: result.guidance.description,
        ctaHref: result.guidance.ctaHref,
        ctaLabel: result.guidance.ctaLabel,
        appealAllowed: result.guidance.appealAllowed,
        interventionId: result.intervention.id,
      });
      await refreshSelectedWorkspace(selectedJobId);
      setStatus(result.guidance.description);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao enviar mensagem.'));
    } finally {
      setSending(false);
    }
  }

  async function handleAppealTrustSafety(intervention: TrustSafetyIntervention) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const reason = appealReason.trim();
    if (reason.length < 3) {
      setStatus('Explica o motivo do pedido de revisão.');
      return;
    }

    setAppealing(true);
    setStatus('A pedir revisão da restrição...');

    try {
      await appealTrustSafetyIntervention(accessToken, intervention.id, { reason });
      setAppealReason('');
      await refreshSelectedWorkspace(intervention.jobId);
      setStatus('Pedido de revisão enviado para Trust & Safety.');
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, 'Falha ao pedir revisão da restrição.'),
      );
    } finally {
      setAppealing(false);
    }
  }

  function handleSelectConversation(jobId: string) {
    setSelectedJobId(jobId);
    router.replace(`${input.basePath}?job=${jobId}`);
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>{input.title}</h1>
            <p className='mt-1 max-w-3xl text-sm text-slate-600'>
              {input.description}
            </p>
          </div>
          <Link
            href={input.homeHref}
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            {input.homeLabel}
          </Link>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]'>
        <aside className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-lg font-semibold text-slate-900'>Conversas</h2>
              <p className='mt-1 text-sm text-slate-600'>
                Cada conversa está ligada a um job.
              </p>
            </div>
            <span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700'>
              {conversations.length}
            </span>
          </div>

          {conversations.length === 0 ? (
            <div className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600'>
              As conversas aparecem depois de existir um job entre cliente e
              prestador.
            </div>
          ) : (
            <div className='mt-4 space-y-3'>
              {conversations.map((conversation) => {
                const isActive = conversation.jobId === selectedJobId;

                return (
                  <button
                    key={conversation.jobId}
                    type='button'
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      isActive
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                    onClick={() => {
                      handleSelectConversation(conversation.jobId);
                    }}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-sm font-semibold text-slate-900'>
                          {conversation.title}
                        </p>
                        <p className='mt-1 text-xs text-slate-500'>
                          {conversation.counterpart.name ?? 'Conta Tchuno'}
                        </p>
                      </div>
                      {conversation.unreadCount > 0 ? (
                        <span className='rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white'>
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>

                    <div className='mt-2 flex flex-wrap items-center gap-2 text-xs'>
                      <span
                        className={`rounded-full px-2.5 py-1 font-semibold ${statusClass(conversation.status)}`}
                      >
                        {formatConversationStatus(conversation.status)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-semibold ${
                          conversation.contactUnlocked
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {conversation.contactUnlocked
                          ? 'Contacto desbloqueado'
                          : 'Contacto protegido'}
                      </span>
                    </div>

                    <p className='mt-3 line-clamp-2 text-sm text-slate-600'>
                      {conversation.latestMessage?.content ??
                        'Ainda sem mensagens nesta conversa.'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
          {!selectedConversation ? (
            <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600'>
              Escolhe uma conversa para ver o histórico e enviar mensagens dentro
              do fluxo oficial.
            </div>
          ) : threadLoading || !thread ? (
            <p className='text-sm text-blue-700'>A carregar conversa...</p>
          ) : (
            <div className='space-y-4'>
              {moderationNotice ? (
                <div className='rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'>
                  <p className='font-semibold'>{moderationNotice.title}</p>
                  <p className='mt-1'>{moderationNotice.description}</p>
                  <Link
                    href={moderationNotice.ctaHref}
                    className='mt-3 inline-flex items-center rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100'
                  >
                    {moderationNotice.ctaLabel}
                  </Link>
                </div>
              ) : null}

              <div className='flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <h2 className='text-lg font-semibold text-slate-900'>
                    {thread.conversation.title}
                  </h2>
                  <p className='mt-1 text-sm text-slate-600'>
                    A falar com{' '}
                    <strong>
                      {thread.conversation.counterpart.name ?? 'Conta Tchuno'}
                    </strong>
                    .
                  </p>
                  {thread.conversation.contactUnlocked &&
                  thread.conversation.counterpart.email ? (
                    <p className='mt-2 text-sm text-emerald-700'>
                      Contacto desbloqueado: {thread.conversation.counterpart.email}
                    </p>
                  ) : (
                    <p className='mt-2 text-sm text-amber-700'>
                      O contacto direto continua protegido até o job cumprir a
                      condição de desbloqueio.
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(thread.conversation.status)}`}
                >
                  {formatConversationStatus(thread.conversation.status)}
                </span>
              </div>

              {thread.trustSafety.activeIntervention ? (
                <div className='rounded-2xl border border-slate-200 bg-slate-50 p-4'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                      <p className='text-sm font-semibold text-slate-900'>
                        Proteção anti-fuga ativa
                      </p>
                      <p className='mt-1 text-sm text-slate-600'>
                        {thread.trustSafety.activeIntervention.reasonSummary}
                      </p>
                      <p className='mt-2 text-xs text-slate-500'>
                        Última mensagem sinalizada: &quot;
                        {thread.trustSafety.activeIntervention.messagePreview}
                        &quot;
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${interventionStatusClass(
                        thread.trustSafety.activeIntervention.status,
                      )}`}
                    >
                      {interventionStatusLabel(
                        thread.trustSafety.activeIntervention.status,
                      )}
                    </span>
                  </div>

                  {thread.trustSafety.activeIntervention.isBlocking &&
                  thread.trustSafety.activeIntervention.blockedUntil ? (
                    <p className='mt-3 text-sm text-amber-800'>
                      O envio de mensagens fica temporariamente restringido até{' '}
                      {new Date(
                        thread.trustSafety.activeIntervention.blockedUntil,
                      ).toLocaleString('pt-PT')}
                      .
                    </p>
                  ) : null}

                  {thread.trustSafety.activeIntervention.appealReason ? (
                    <p className='mt-3 text-sm text-slate-600'>
                      Apelação enviada: {thread.trustSafety.activeIntervention.appealReason}
                    </p>
                  ) : null}

                  {thread.trustSafety.activeIntervention.resolutionNote ? (
                    <p className='mt-3 text-sm text-slate-600'>
                      Nota da equipa: {thread.trustSafety.activeIntervention.resolutionNote}
                    </p>
                  ) : null}

                  {['OPEN', 'ENFORCED'].includes(
                    thread.trustSafety.activeIntervention.status,
                  ) ? (
                    <div className='mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3'>
                      <p className='text-sm font-medium text-slate-900'>
                        Pedir revisão
                      </p>
                      <textarea
                        value={appealReason}
                        onChange={(event) => setAppealReason(event.target.value)}
                        maxLength={240}
                        className='min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                        placeholder='Explica por que esta mensagem deve ser revista pela equipa.'
                        disabled={appealing}
                      />
                      <button
                        type='button'
                        className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleAppealTrustSafety(
                            thread.trustSafety.activeIntervention!,
                          );
                        }}
                        disabled={appealing}
                      >
                        {appealing ? 'A enviar revisão...' : 'Pedir revisão'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {financial ? (
                <JobProtectionPanel
                  accessToken={accessToken ?? ''}
                  jobId={thread.conversation.jobId}
                  financial={financial}
                  viewerRole={input.viewerRole}
                  onRefresh={async () => {
                    await refreshSelectedWorkspace(thread.conversation.jobId);
                  }}
                  onStatusChange={setStatus}
                  showOpenRequestLink={
                    input.viewerRole === 'customer' && thread.conversation.requestId
                      ? {
                          href: `/app/pedidos/${thread.conversation.requestId}`,
                          label: 'Abrir detalhe do pedido',
                        }
                      : null
                  }
                />
              ) : null}

              <div className='space-y-3'>
                {thread.items.length === 0 ? (
                  <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600'>
                    Ainda não existem mensagens. Usa o campo abaixo para começar a
                    conversa neste job.
                  </div>
                ) : (
                  thread.items.map((message) => {
                    const isOwnMessage = message.senderUserId === viewerUserId;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isOwnMessage ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <article
                          className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isOwnMessage
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-800'
                          }`}
                        >
                          <p>{message.content}</p>
                          <p
                            className={`mt-2 text-xs ${
                              isOwnMessage ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {new Date(message.createdAt).toLocaleString('pt-PT')}
                          </p>
                        </article>
                      </div>
                    );
                  })
                )}
              </div>

              <div className='space-y-3 border-t border-slate-200 pt-4'>
                <label className='block space-y-2 text-sm text-slate-700'>
                  <span>Nova mensagem</span>
                  <textarea
                    value={messageInput}
                    onChange={(event) => {
                      setMessageInput(event.target.value);
                    }}
                    maxLength={1000}
                    className='min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                    placeholder='Escreve uma atualização, pergunta ou combinação de próximos passos.'
                    disabled={
                      sending ||
                      thread.conversation.status === 'CANCELED' ||
                      Boolean(thread.trustSafety.activeIntervention?.isBlocking)
                    }
                  />
                </label>

                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <p className='text-xs text-slate-500'>
                    {thread.conversation.contactUnlocked
                      ? 'Contacto desbloqueado. O job mantém histórico e proteção dentro do Tchuno.'
                      : 'Antes do sinal, o Tchuno bloqueia tentativas de partilha de contacto externo e mantém o histórico protegido.'}
                  </p>
                  <button
                    type='button'
                    className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                    onClick={() => {
                      void handleSendMessage();
                    }}
                    disabled={
                      sending ||
                      thread.conversation.status === 'CANCELED' ||
                      Boolean(thread.trustSafety.activeIntervention?.isBlocking) ||
                      messageInput.trim().length === 0
                    }
                  >
                    {sending ? 'A enviar...' : 'Enviar mensagem'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
