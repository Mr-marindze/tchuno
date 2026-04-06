'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatRatingValue } from '@/components/dashboard/dashboard-formatters';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getJobById, JobDetails } from '@/lib/jobs';
import {
  getJobFinancialState,
  JobFinancialState,
  payPaymentIntent,
} from '@/lib/payments';
import {
  createRequestInvitation,
  getServiceRequestById,
  selectProposal,
  ServiceRequest,
} from '@/lib/service-requests';
import {
  buildRequestWorkerRecommendations,
  RecommendationPoolScope,
  RequestWorkerRecommendation,
} from '@/lib/request-worker-recommendations';
import {
  listWorkerProfiles,
  resolveWorkerDisplayName,
  WorkerProfile,
} from '@/lib/worker-profile';

const payableIntentStatuses = new Set([
  'AWAITING_PAYMENT',
  'PENDING_CONFIRMATION',
  'FAILED',
  'CREATED',
]);

const paymentStatusLabel: Record<string, string> = {
  CREATED: 'Criado',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID_PARTIAL: 'Sinal pago',
  PENDING_CONFIRMATION: 'Em confirmação',
  SUCCEEDED: 'Pago',
  FAILED: 'Falhado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
};

const invitationStatusLabel: Record<string, string> = {
  SENT: 'Convite enviado',
  ACCEPTED: 'Aceite',
  DECLINED: 'Recusado',
  EXPIRED: 'Expirado',
};

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function resolveFlowVisualState(
  request: ServiceRequest | null,
  financial: JobFinancialState | null,
) {
  if (!request) {
    return {
      label: 'Aguardando propostas',
      description: 'Ainda sem dados suficientes para este pedido.',
      className: 'bg-blue-100 text-blue-700 ring-blue-200',
    };
  }

  if (request.status === 'EXPIRED' || request.job?.status === 'CANCELED') {
    return {
      label: 'Cancelado',
      description: 'Fluxo encerrado sem conclusão.',
      className: 'bg-rose-50 text-rose-700 ring-rose-200',
    };
  }

  if (request.job?.status === 'COMPLETED') {
    return {
      label: 'Concluído',
      description: 'Serviço concluído e registado.',
      className: 'bg-emerald-800 text-white ring-emerald-700',
    };
  }

  if (request.job?.contactUnlockedAt) {
    return {
      label: 'Em execução',
      description: 'Contacto desbloqueado e job em curso.',
      className: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    };
  }

  const hasPendingPayment =
    financial?.intents.some((intent) => payableIntentStatuses.has(intent.status)) ??
    false;

  if (hasPendingPayment || request.selectedProposalId) {
    return {
      label: 'Pagamento pendente',
      description: 'Sinal obrigatório para desbloquear contacto.',
      className: 'bg-orange-100 text-orange-700 ring-orange-200',
    };
  }

  if ((request.proposals?.length ?? 0) > 0) {
    return {
      label: 'Escolher prestador',
      description: 'Seleciona uma proposta para criar o job.',
      className: 'bg-amber-100 text-amber-700 ring-amber-200',
    };
  }

  return {
    label: 'Aguardando propostas',
    description: 'Pedido aberto à espera de propostas.',
    className: 'bg-blue-100 text-blue-700 ring-blue-200',
  };
}

function getInvitationBadgeClass(status: string) {
  if (status === 'ACCEPTED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'DECLINED') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'EXPIRED') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-blue-100 text-blue-700';
}

async function loadCandidateWorkersForRequest(request: ServiceRequest): Promise<{
  workers: WorkerProfile[];
  scope: RecommendationPoolScope;
}> {
  if (request.category?.slug) {
    const categoryWorkers = await listWorkerProfiles({
      categorySlug: request.category.slug,
      isAvailable: true,
      sort: 'rating:desc',
      page: 1,
      limit: 48,
    });

    if (categoryWorkers.data.length > 0) {
      return {
        workers: categoryWorkers.data,
        scope: 'category-available',
      };
    }
  }

  const catalogWorkers = await listWorkerProfiles({
    isAvailable: true,
    sort: 'rating:desc',
    page: 1,
    limit: 48,
  });

  return {
    workers: catalogWorkers.data,
    scope: 'catalog-available',
  };
}

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [financial, setFinancial] = useState<JobFinancialState | null>(null);
  const [recommendedWorkers, setRecommendedWorkers] = useState<
    RequestWorkerRecommendation[]
  >([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationStatus, setRecommendationStatus] = useState(
    'A preparar sugestões para o teu pedido...',
  );
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [invitingWorkerId, setInvitingWorkerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState(false);
  const [status, setStatus] = useState('A carregar detalhes do pedido...');

  async function loadDetails(tokenOverride?: string) {
    const token = tokenOverride ?? accessToken;
    if (!token) {
      setStatus('Sessão inválida. Faz login novamente.');
      setRequest(null);
      setJobDetails(null);
      setFinancial(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const nextRequest = await getServiceRequestById(token, requestId);
      setRequest(nextRequest);

      if (nextRequest.job?.id) {
        const [nextJob, nextFinancial] = await Promise.all([
          getJobById(token, nextRequest.job.id),
          getJobFinancialState(token, nextRequest.job.id),
        ]);

        setJobDetails(nextJob);
        setFinancial(nextFinancial);
      } else {
        setJobDetails(null);
        setFinancial(null);
      }

      setStatus('Detalhes do pedido atualizados.');
    } catch (error) {
      setRequest(null);
      setJobDetails(null);
      setFinancial(null);
      setStatus(humanizeUnknownError(error, 'Falha ao carregar pedido.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = await ensureSession();
      if (!active) {
        return;
      }

      if (!session?.auth.accessToken) {
        setAccessToken(null);
        setStatus('Sessão inválida. Faz login novamente.');
        setLoading(false);
        return;
      }

      setAccessToken(session.auth.accessToken);
      await loadDetails(session.auth.accessToken);
    }

    void bootstrap();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    setInviteFeedback('');
  }, [requestId]);

  const selectedProposal = useMemo(() => {
    if (!request?.selectedProposalId) {
      return null;
    }

    return (
      request.proposals?.find(
        (proposal) => proposal.id === request.selectedProposalId,
      ) ?? null
    );
  }, [request]);

  const payableIntent = useMemo(() => {
    if (!financial) {
      return null;
    }

    return (
      financial.intents.find((intent) => payableIntentStatuses.has(intent.status)) ??
      null
    );
  }, [financial]);

  const latestIntent = useMemo(() => financial?.intents[0] ?? null, [financial]);
  const flowState = resolveFlowVisualState(request, financial);
  const canInviteWorkers =
    request?.status === 'OPEN' && !request.selectedProposalId;
  const invitationByProviderUserId = useMemo(
    () =>
      new Map(
        (request?.invitations ?? []).map((invitation) => [
          invitation.providerUserId,
          invitation,
        ]),
      ),
    [request?.invitations],
  );
  const primaryActionCopy = useMemo(() => {
    if (!request) {
      return null;
    }

    if (jobDetails?.contactUnlocked) {
      return {
        title: 'Contacto desbloqueado',
        description:
          'Já podes combinar os próximos passos da execução com o prestador selecionado.',
      };
    }

    if (payableIntent) {
      return {
        title: 'Pagar sinal',
        description:
          'Confirma o pagamento do sinal para desbloquear o contacto e iniciar a execução.',
      };
    }

    if ((request.proposals?.length ?? 0) > 0) {
      return {
        title: 'Selecionar proposta',
        description:
          'Escolhe uma das propostas acima para criar o job e avançar para o pagamento do sinal.',
      };
    }

    if (canInviteWorkers) {
      return {
        title: 'Aguardar propostas',
        description:
          'Enquanto esperas, podes convidar profissionais relevantes para acelerar respostas.',
      };
    }

    return {
      title: 'Aguardar atualização',
      description: 'O pedido continua a avançar dentro do fluxo oficial do Tchuno.',
    };
  }, [canInviteWorkers, jobDetails?.contactUnlocked, payableIntent, request]);

  useEffect(() => {
    let active = true;

    async function loadRecommendedWorkers() {
      if (!request) {
        if (active) {
          setRecommendedWorkers([]);
          setRecommendationLoading(false);
          setRecommendationStatus('Ainda sem pedido carregado.');
        }
        return;
      }

      if (!canInviteWorkers) {
        if (active) {
          setRecommendedWorkers([]);
          setRecommendationLoading(false);
          setRecommendationStatus(
            'Os convites para proposta fecham assim que uma proposta é selecionada.',
          );
        }
        return;
      }

      setRecommendationLoading(true);
      setRecommendationStatus('A procurar profissionais relevantes para este pedido...');

      try {
        const { workers, scope } = await loadCandidateWorkersForRequest(request);

        if (!active) {
          return;
        }

        const nextRecommendations = buildRequestWorkerRecommendations(
          request,
          workers,
          scope,
        );

        setRecommendedWorkers(nextRecommendations.items);
        setRecommendationStatus(nextRecommendations.statusMessage);
      } catch (error) {
        if (!active) {
          return;
        }

        setRecommendedWorkers([]);
        setRecommendationStatus(
          humanizeUnknownError(
            error,
            'Não foi possível carregar profissionais sugeridos.',
          ),
        );
      } finally {
        if (active) {
          setRecommendationLoading(false);
        }
      }
    }

    void loadRecommendedWorkers();

    return () => {
      active = false;
    };
  }, [canInviteWorkers, request]);

  async function handleInviteWorker(workerId: string, workerName: string) {
    if (!accessToken || !request) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setInvitingWorkerId(workerId);
    setInviteFeedback('');

    try {
      await createRequestInvitation(accessToken, request.id, {
        providerUserId: workerId,
      });
      await loadDetails(accessToken);
      setInviteFeedback(`${workerName} foi convidado para enviar proposta.`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao enviar convite.'));
    } finally {
      setInvitingWorkerId(null);
    }
  }

  async function handleSelectProposal(proposalId: string) {
    if (!accessToken || !request) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningAction(true);
    setStatus('A selecionar prestador...');

    try {
      await selectProposal(accessToken, request.id, proposalId);
      await loadDetails(accessToken);
      setStatus('Prestador selecionado. Avança para o pagamento do sinal.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao selecionar proposta.'));
    } finally {
      setRunningAction(false);
    }
  }

  async function handlePayDeposit() {
    if (!accessToken || !payableIntent) {
      setStatus('Nenhum sinal pendente para pagamento.');
      return;
    }

    setRunningAction(true);
    setStatus('A processar pagamento do sinal...');

    try {
      await payPaymentIntent(accessToken, payableIntent.id, {
        ...(payableIntent.provider === 'INTERNAL' ? { simulate: 'success' } : {}),
      });
      await loadDetails(accessToken);
      setStatus('Pagamento confirmado. Contacto desbloqueado.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao processar pagamento.'));
    } finally {
      setRunningAction(false);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>
              Detalhe do pedido
            </h1>
            <p className='mt-1 text-sm text-slate-600'>
              Seleção do prestador, pagamento do sinal e desbloqueio de contacto.
            </p>
          </div>
          <Link
            href='/app/pedidos'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Voltar aos pedidos
          </Link>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      {!request ? null : (
        <>
          <section className='grid gap-4 lg:grid-cols-2'>
            <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                Resumo do pedido
              </p>
              <h2 className='mt-2 text-lg font-semibold text-slate-900'>
                {request.title}
              </h2>
              <p className='mt-2 text-sm text-slate-600'>{request.description}</p>
              <dl className='mt-4 space-y-1 text-sm text-slate-600'>
                <div>
                  <dt className='inline font-medium text-slate-700'>Local:</dt>{' '}
                  <dd className='inline'>{request.location ?? 'n/d'}</dd>
                </div>
                <div>
                  <dt className='inline font-medium text-slate-700'>Categoria:</dt>{' '}
                  <dd className='inline'>
                    {request.category?.name ?? request.categoryId}
                  </dd>
                </div>
                <div>
                  <dt className='inline font-medium text-slate-700'>Criado:</dt>{' '}
                  <dd className='inline'>
                    {new Date(request.createdAt).toLocaleString('pt-PT')}
                  </dd>
                </div>
              </dl>
            </article>

            <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                Estado atual
              </p>
              <div className='mt-3 flex flex-wrap items-center gap-2'>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${flowState.className}`}
                >
                  {flowState.label}
                </span>
                <span className='text-xs text-slate-500'>#{request.id.slice(0, 8)}</span>
              </div>
              <p className='mt-2 text-sm text-slate-600'>{flowState.description}</p>

              <div className='mt-4 grid grid-cols-2 gap-3 text-sm'>
                <div className='rounded-lg bg-slate-50 p-3'>
                  <p className='text-xs text-slate-500'>Propostas</p>
                  <p className='mt-1 font-semibold text-slate-900'>
                    {request.proposals?.length ?? 0}
                  </p>
                </div>
                <div className='rounded-lg bg-slate-50 p-3'>
                  <p className='text-xs text-slate-500'>Job</p>
                  <p className='mt-1 font-semibold text-slate-900'>
                    {request.job?.status ?? 'Pendente'}
                  </p>
                </div>
              </div>
            </article>
          </section>

          {canInviteWorkers ? (
            <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                    Sugestões
                  </p>
                  <h2 className='mt-2 text-lg font-semibold text-slate-900'>
                    Profissionais próximos de ti
                  </h2>
                  <p className='mt-1 max-w-3xl text-sm text-slate-600'>
                    {request.location
                      ? 'Usamos a localização do teu pedido para dar prioridade a perfis da mesma zona ou de zonas próximas. Quando não há correspondência suficiente, alargamos a procura.'
                      : 'O teu pedido ainda não tem localização suficiente para medir proximidade. Por agora mostramos perfis relevantes por área, reputação e disponibilidade.'}
                  </p>
                </div>

                <div className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600'>
                  {recommendedWorkers.length} sugestão(ões)
                </div>
              </div>

              <p
                className={`mt-4 text-sm ${
                  recommendationLoading ? 'text-blue-700' : 'text-slate-600'
                }`}
              >
                {recommendationStatus}
              </p>

              {inviteFeedback ? (
                <p className='mt-2 text-sm text-blue-700'>{inviteFeedback}</p>
              ) : null}

              <div className='mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800'>
                Esta lista serve para acelerar propostas. Não mostra contacto
                direto nem cria contratação fora do fluxo oficial.
              </div>

              {request.invitations && request.invitations.length > 0 ? (
                <div className='mt-4 space-y-3'>
                  <p className='text-sm font-semibold text-slate-900'>
                    Convites enviados
                  </p>
                  <div className='grid gap-3 xl:grid-cols-2'>
                    {request.invitations.map((invitation) => {
                      const providerName =
                        invitation.providerUser?.name ??
                        `Prestador ${invitation.providerUserId.slice(0, 8)}`;
                      const providerRating = invitation.providerUser?.workerProfile
                        ? `${formatRatingValue(
                            invitation.providerUser.workerProfile.ratingAvg,
                          )} (${invitation.providerUser.workerProfile.ratingCount})`
                        : 'Novo';

                      return (
                        <article
                          key={invitation.id}
                          className='rounded-2xl border border-slate-200 bg-slate-50 p-4'
                        >
                          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                            <div>
                              <p className='text-sm font-semibold text-slate-900'>
                                {providerName}
                              </p>
                              <p className='mt-1 text-sm text-slate-600'>
                                Rating {providerRating}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getInvitationBadgeClass(invitation.status)}`}
                            >
                              {invitationStatusLabel[invitation.status] ??
                                invitation.status}
                            </span>
                          </div>

                          <p className='mt-3 text-xs text-slate-500'>
                            {invitation.respondedAt
                              ? `Atualizado em ${new Date(
                                  invitation.respondedAt,
                                ).toLocaleString('pt-PT')}`
                              : `Enviado em ${new Date(
                                  invitation.createdAt,
                                ).toLocaleString('pt-PT')}`}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {request.proposals && request.proposals.length > 0 ? (
                <p className='mt-3 text-xs text-slate-500'>
                  Perfis que já enviaram proposta ficam fora desta lista para
                  evitar repetição.
                </p>
              ) : null}

              {!recommendationLoading ? (
                recommendedWorkers.length === 0 ? (
                  <div className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600'>
                    {request.location
                      ? 'Ainda não encontrámos perfis da mesma zona ou de zonas próximas. Continuamos a procurar dentro desta área.'
                      : 'Ainda não temos localização suficiente no pedido. Continuamos a mostrar perfis relevantes desta área.'}
                  </div>
                ) : (
                  <div className='mt-4 grid gap-3 xl:grid-cols-2'>
                    {recommendedWorkers.map((item) => {
                      const worker = item.worker;
                      const displayName = resolveWorkerDisplayName(worker);
                      const specialty =
                        worker.categories[0]?.name ??
                        request.category?.name ??
                        'Serviço local';
                      const availabilityLabel = worker.isAvailable
                        ? 'Disponível agora'
                        : 'Agenda limitada';
                      const ratingLabel =
                        worker.ratingCount > 0
                          ? `⭐ ${formatRatingValue(worker.ratingAvg)} (${worker.ratingCount})`
                          : '⭐ Novo';
                      const existingInvitation = invitationByProviderUserId.get(
                        worker.userId,
                      );
                      const isInviting = invitingWorkerId === worker.userId;
                      const inviteLabel = existingInvitation
                        ? invitationStatusLabel[existingInvitation.status] ??
                          existingInvitation.status
                        : isInviting
                          ? 'A enviar...'
                          : 'Convidar para proposta';

                      return (
                        <article
                          key={worker.id}
                          className='rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition-shadow hover:shadow-md'
                        >
                          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                            <div>
                              <h3 className='text-base font-semibold text-slate-900'>
                                {displayName}
                              </h3>
                              <p className='mt-1 text-sm text-slate-600'>
                                {specialty}
                              </p>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                worker.isAvailable
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {availabilityLabel}
                            </span>
                          </div>

                          <div className='mt-4 grid gap-3 sm:grid-cols-3'>
                            <div className='rounded-xl border border-slate-200 bg-white p-3'>
                              <p className='text-xs text-slate-500'>Rating</p>
                              <p className='mt-1 text-sm font-semibold text-slate-900'>
                                {ratingLabel}
                              </p>
                            </div>
                            <div className='rounded-xl border border-slate-200 bg-white p-3'>
                              <p className='text-xs text-slate-500'>Proximidade</p>
                              <p className='mt-1 text-sm font-semibold text-slate-900'>
                                {item.proximityLabel}
                              </p>
                            </div>
                            <div className='rounded-xl border border-slate-200 bg-white p-3'>
                              <p className='text-xs text-slate-500'>Disponibilidade</p>
                              <p className='mt-1 text-sm font-semibold text-slate-900'>
                                {availabilityLabel}
                              </p>
                            </div>
                          </div>

                          <p className='mt-4 text-sm text-slate-600'>
                            {item.shortComment}
                          </p>

                          <button
                            type='button'
                            className='mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                            onClick={() => {
                              void handleInviteWorker(worker.userId, displayName);
                            }}
                            disabled={Boolean(existingInvitation) || isInviting}
                          >
                            {inviteLabel}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )
              ) : null}
            </section>
          ) : null}

          <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
              Propostas recebidas
            </p>

            {!request.proposals || request.proposals.length === 0 ? (
              <p className='mt-3 text-sm text-slate-600'>
                Ainda sem propostas para este pedido.
              </p>
            ) : (
              <div className='mt-3 space-y-3'>
                {request.proposals.map((proposal) => {
                  const isSelected = proposal.id === request.selectedProposalId;
                  const canSelect =
                    request.status === 'OPEN' && !request.selectedProposalId;

                  return (
                    <article
                      key={proposal.id}
                      className={`rounded-xl border p-4 ${
                        isSelected
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='space-y-1'>
                          <p className='text-sm font-semibold text-slate-900'>
                            {proposal.provider?.name ?? `Prestador ${proposal.providerId.slice(0, 8)}`}
                          </p>
                          <p className='text-sm text-slate-700'>
                            {formatCurrencyMzn(proposal.price)}
                          </p>
                          <p className='text-sm text-slate-600'>
                            {proposal.comment ?? 'Sem comentário'}
                          </p>
                          <p className='text-xs text-slate-500'>
                            Rating:{' '}
                            {proposal.provider?.workerProfile
                              ? `${proposal.provider.workerProfile.ratingAvg} (${proposal.provider.workerProfile.ratingCount})`
                              : 'n/d'}
                          </p>
                        </div>

                        <div className='flex flex-wrap items-center gap-2'>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isSelected
                                ? 'bg-amber-200 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isSelected ? 'Selecionada' : proposal.status}
                          </span>
                          {canSelect ? (
                            <button
                              type='button'
                              className='inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                              onClick={() => {
                                void handleSelectProposal(proposal.id);
                              }}
                              disabled={runningAction}
                            >
                              Selecionar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
              Ação principal
            </p>
            <h2 className='mt-2 text-lg font-semibold text-slate-900'>
              {primaryActionCopy?.title ?? 'Próximo passo'}
            </h2>
            <p className='mt-2 text-sm text-slate-600'>
              {primaryActionCopy?.description}
            </p>

            {jobDetails?.contactUnlocked ? (
              <div className='mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'>
                <p className='font-semibold'>Contacto desbloqueado</p>
                <p className='mt-1'>
                  {jobDetails.providerContact?.name ?? 'Prestador selecionado'}
                </p>
                <p>{jobDetails.providerContact?.email ?? 'Email indisponível'}</p>
                <p className='mt-2 text-emerald-700'>
                  Job em estado: {request.job?.status ?? 'n/d'}
                </p>
              </div>
            ) : (
              <div className='mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800'>
                <p className='font-semibold'>Contacto bloqueado até pagamento</p>
                <p className='mt-1'>
                  O contacto direto só fica disponível após confirmação do sinal.
                </p>
              </div>
            )}

            {payableIntent ? (
              <div className='mt-4 flex flex-wrap items-center gap-3'>
                <button
                  type='button'
                  className='inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60'
                  onClick={() => {
                    void handlePayDeposit();
                  }}
                  disabled={runningAction}
                >
                  {runningAction ? 'A processar...' : 'Pagar sinal'}
                </button>

                <Link
                  href='/app/pagamentos'
                  className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                >
                  Ver histórico de pagamentos
                </Link>
              </div>
            ) : request.job ? (
              <div className='mt-4 text-sm text-slate-600'>
                <p>
                  <strong>Job:</strong> {request.job.id.slice(0, 10)}
                </p>
                <p>
                  <strong>Estado:</strong> {request.job.status}
                </p>
              </div>
            ) : (
              <p className='mt-4 text-sm text-slate-600'>
                O job será criado automaticamente após selecionar uma proposta.
              </p>
            )}
          </section>

          <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
              Informação financeira
            </p>
            <div className='mt-3 space-y-2 text-sm text-slate-700'>
              <p>
                <strong>Proposta selecionada:</strong>{' '}
                {selectedProposal
                  ? formatCurrencyMzn(selectedProposal.price)
                  : 'Ainda não selecionada'}
              </p>
              <p>
                <strong>Valor do sinal:</strong>{' '}
                {latestIntent ? formatCurrencyMzn(latestIntent.amount) : 'n/d'}
              </p>
              <p>
                <strong>Estado do pagamento:</strong>{' '}
                {latestIntent
                  ? paymentStatusLabel[latestIntent.status] ?? latestIntent.status
                  : 'Não iniciado'}
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
