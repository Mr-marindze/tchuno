'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatRatingValue } from '@/components/dashboard/dashboard-formatters';
import { JobProtectionPanel } from '@/components/payments/job-protection-panel';
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
  recreateServiceRequest,
  RequestInvitation,
  selectProposal,
  ServiceRequest,
  updateServiceRequest,
} from '@/lib/service-requests';
import {
  buildRequestWorkerRecommendations,
  RecommendationPoolScope,
  RequestWorkerRecommendation,
} from '@/lib/request-worker-recommendations';
import { createReview } from '@/lib/reviews';
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

const proposalStatusLabel: Record<string, string> = {
  SUBMITTED: 'Recebida',
  SELECTED: 'Selecionada',
  REJECTED: 'Não selecionada',
};

type ServiceRequestProposal = NonNullable<ServiceRequest['proposals']>[number];
type RequestActivityTone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';

type RequestActivityItem = {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
  tone: RequestActivityTone;
};

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRequestExpiryText(request: ServiceRequest): string {
  const formattedDate = new Date(request.expiresAt).toLocaleString('pt-PT');

  if (request.status === 'EXPIRED') {
    return `Expirou em ${formattedDate}`;
  }

  if (request.status === 'OPEN') {
    return `Expira em ${formattedDate}`;
  }

  return `Validade inicial: ${formattedDate}`;
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

  if (request.status === 'EXPIRED') {
    return {
      label: 'Expirado',
      description: 'Pedido expirado sem seleção. Cria um novo pedido para voltar a receber propostas.',
      className: 'bg-slate-200 text-slate-700 ring-slate-300',
    };
  }

  if (request.job?.status === 'CANCELED') {
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

function getProposalBadgeClass(status: string) {
  if (status === 'SELECTED') {
    return 'bg-amber-200 text-amber-800';
  }

  if (status === 'REJECTED') {
    return 'bg-slate-200 text-slate-700';
  }

  return 'bg-emerald-100 text-emerald-700';
}

function getActivityToneClass(tone: RequestActivityTone) {
  if (tone === 'emerald') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }

  if (tone === 'amber') {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (tone === 'rose') {
    return 'border-rose-200 bg-rose-50 text-rose-900';
  }

  if (tone === 'blue') {
    return 'border-blue-200 bg-blue-50 text-blue-900';
  }

  return 'border-slate-200 bg-slate-50 text-slate-900';
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return 'n/d';
  }

  return new Date(value).toLocaleString('pt-PT');
}

function resolveInvitationProviderName(invitation: RequestInvitation): string {
  return (
    invitation.providerUser?.name ??
    `Prestador ${invitation.providerUserId.slice(0, 8)}`
  );
}

function resolveProposalProviderName(proposal: ServiceRequestProposal): string {
  return proposal.provider?.name ?? `Prestador ${proposal.providerId.slice(0, 8)}`;
}

function buildRequestActivityTimeline(
  request: ServiceRequest | null,
): RequestActivityItem[] {
  if (!request) {
    return [];
  }

  const items: RequestActivityItem[] = [
    {
      id: `request-created-${request.id}`,
      occurredAt: request.createdAt,
      title: 'Pedido criado',
      description: 'O pedido ficou disponível para propostas e convites.',
      tone: 'blue',
    },
  ];

  if (request.lastCustomerEditAt) {
    items.push({
      id: `request-edited-${request.id}`,
      occurredAt: request.lastCustomerEditAt,
      title: 'Pedido ajustado',
      description:
        'Detalhes ou prazo foram afinados para melhorar a operação do pedido.',
      tone: 'amber',
    });
  }

  (request.invitations ?? []).forEach((invitation) => {
    const providerName = resolveInvitationProviderName(invitation);

    items.push({
      id: `invitation-created-${invitation.id}`,
      occurredAt: invitation.createdAt,
      title: `Convite enviado a ${providerName}`,
      description: 'O prestador entrou no acompanhamento operacional deste pedido.',
      tone: 'blue',
    });

    if (invitation.openedAt) {
      items.push({
        id: `invitation-opened-${invitation.id}`,
        occurredAt: invitation.openedAt,
        title: `${providerName} já viu o convite`,
        description: 'O pedido já foi aberto do lado do prestador.',
        tone: 'amber',
      });
    }

    if (!invitation.respondedAt) {
      return;
    }

    if (invitation.status === 'ACCEPTED') {
      items.push({
        id: `invitation-accepted-${invitation.id}`,
        occurredAt: invitation.respondedAt,
        title: `${providerName} respondeu ao convite`,
        description: 'O convite converteu em proposta dentro do pedido.',
        tone: 'emerald',
      });
      return;
    }

    if (invitation.status === 'DECLINED') {
      items.push({
        id: `invitation-declined-${invitation.id}`,
        occurredAt: invitation.respondedAt,
        title: `${providerName} recusou o convite`,
        description: 'Mantemos esta resposta no histórico para contexto futuro.',
        tone: 'rose',
      });
      return;
    }

    if (invitation.status === 'EXPIRED') {
      items.push({
        id: `invitation-expired-${invitation.id}`,
        occurredAt: invitation.respondedAt,
        title: `Convite expirado para ${providerName}`,
        description: 'O pedido seguiu sem resposta útil deste convite.',
        tone: 'slate',
      });
    }
  });

  (request.proposals ?? []).forEach((proposal) => {
    const providerName = resolveProposalProviderName(proposal);

    items.push({
      id: `proposal-created-${proposal.id}`,
      occurredAt: proposal.createdAt,
      title: `Proposta recebida de ${providerName}`,
      description: `Valor proposto: ${formatCurrencyMzn(proposal.price)}.`,
      tone: 'emerald',
    });

    if (proposal.status === 'SELECTED') {
      items.push({
        id: `proposal-selected-${proposal.id}`,
        occurredAt: proposal.updatedAt ?? request.job?.createdAt ?? proposal.createdAt,
        title: `${providerName} foi selecionado`,
        description: 'O pedido avançou para job e preparação do pagamento.',
        tone: 'amber',
      });
      return;
    }

    if (proposal.status === 'REJECTED') {
      items.push({
        id: `proposal-rejected-${proposal.id}`,
        occurredAt: proposal.updatedAt ?? proposal.createdAt,
        title: `Proposta de ${providerName} ficou em histórico`,
        description: 'O pedido avançou com outra opção, sem perder rastreabilidade.',
        tone: 'slate',
      });
    }
  });

  if (request.job?.contactUnlockedAt) {
    items.push({
      id: `job-contact-unlocked-${request.job.id}`,
      occurredAt: request.job.contactUnlockedAt,
      title: 'Contacto desbloqueado',
      description: 'O pagamento do sinal foi confirmado e o job entrou em execução.',
      tone: 'emerald',
    });
  }

  if (request.job?.review?.createdAt) {
    items.push({
      id: `job-review-${request.job.review.id}`,
      occurredAt: request.job.review.createdAt,
      title: 'Avaliação registada',
      description: 'O ciclo operacional do pedido foi fechado com feedback.',
      tone: 'emerald',
    });
  }

  return items.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
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
  const router = useRouter();
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
  const [recreatingRequest, setRecreatingRequest] = useState(false);
  const [adjustingRequest, setAdjustingRequest] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustTitle, setAdjustTitle] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjustLocation, setAdjustLocation] = useState('');
  const [extendExpiryHours, setExtendExpiryHours] = useState('0');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
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
  const canAdjustRequest = Boolean(
    request &&
      !request.selectedProposalId &&
      !request.job &&
      (request.status === 'OPEN' || request.status === 'EXPIRED'),
  );
  const existingReview = request?.job?.review ?? null;
  const canReviewRequest =
    request?.job?.status === 'COMPLETED' && !existingReview;
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
  const operationalSnapshot = useMemo(() => {
    if (!request) {
      return null;
    }

    const invitations = request.invitations ?? [];
    const pendingInvitations = invitations.filter(
      (invitation) => invitation.status === 'SENT',
    );
    const seenInvitations = invitations.filter((invitation) => invitation.openedAt);
    const seenPendingInvitations = pendingInvitations.filter(
      (invitation) => invitation.openedAt,
    );
    const waitingProviders = pendingInvitations.map(resolveInvitationProviderName);
    const waitingSeenProviders = seenPendingInvitations.map(
      resolveInvitationProviderName,
    );

    return {
      totalInvitations: invitations.length,
      seenInvitations: seenInvitations.length,
      pendingInvitations: pendingInvitations.length,
      seenPendingInvitations: seenPendingInvitations.length,
      unseenPendingInvitations:
        pendingInvitations.length - seenPendingInvitations.length,
      acceptedInvitations: invitations.filter(
        (invitation) => invitation.status === 'ACCEPTED',
      ).length,
      declinedInvitations: invitations.filter(
        (invitation) => invitation.status === 'DECLINED',
      ).length,
      proposalsReceived: request.proposals?.length ?? 0,
      waitingProviders,
      waitingSeenProviders,
    };
  }, [request]);
  const requestActivity = useMemo(
    () => buildRequestActivityTimeline(request),
    [request],
  );
  const primaryActionCopy = useMemo(() => {
    if (!request) {
      return null;
    }

    if (canReviewRequest) {
      return {
        title: 'Avaliar serviço',
        description:
          'O trabalho foi concluído. Deixa a tua avaliação para fechar o ciclo e atualizar a reputação do prestador.',
      };
    }

    if (existingReview) {
      return {
        title: 'Avaliação enviada',
        description:
          'A tua avaliação já foi registada e conta para a reputação pública do prestador.',
      };
    }

    if (request.status === 'EXPIRED') {
      return {
        title: 'Reabrir com ajustes',
        description:
          'Este pedido expirou sem seleção. Podes criar um novo pedido igual ou ajustá-lo antes de voltar a procurar respostas.',
      };
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
  }, [
    canInviteWorkers,
    canReviewRequest,
    existingReview,
    jobDetails?.contactUnlocked,
    payableIntent,
    request,
  ]);

  useEffect(() => {
    setReviewRating(5);
    setReviewComment('');
  }, [requestId, existingReview?.id]);

  useEffect(() => {
    setAdjustTitle(request?.title ?? '');
    setAdjustDescription(request?.description ?? '');
    setAdjustLocation(request?.location ?? '');
    setExtendExpiryHours('0');
  }, [request?.description, request?.id, request?.location, request?.title]);

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

  async function handleRecreateRequest() {
    if (!accessToken || !request) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRecreatingRequest(true);
    setStatus('A criar um novo pedido a partir deste pedido expirado...');

    try {
      const recreated = await recreateServiceRequest(accessToken, request.id);
      setStatus('Novo pedido criado a partir do pedido expirado.');
      router.push(`/app/pedidos/${recreated.id}`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao recriar pedido.'));
    } finally {
      setRecreatingRequest(false);
    }
  }

  async function handleAdjustRequest() {
    if (!accessToken || !request) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const normalizedTitle = adjustTitle.trim();
    const normalizedDescription = adjustDescription.trim();
    const normalizedLocation = adjustLocation.trim();
    const parsedExtendHours = Number(extendExpiryHours);
    const extendHours =
      Number.isFinite(parsedExtendHours) && parsedExtendHours > 0
        ? Math.trunc(parsedExtendHours)
        : 0;

    if (normalizedTitle.length < 3) {
      setStatus('Define um título com pelo menos 3 caracteres.');
      return;
    }

    if (normalizedDescription.length < 10) {
      setStatus('A descrição precisa de pelo menos 10 caracteres.');
      return;
    }

    const contentChanged =
      normalizedTitle !== request.title ||
      normalizedDescription !== request.description ||
      normalizedLocation !== (request.location ?? '');

    if (request.status === 'OPEN' && !contentChanged && extendHours === 0) {
      setStatus('Ainda não alteraste nada neste pedido.');
      return;
    }

    setAdjustingRequest(true);
    setStatus(
      request.status === 'EXPIRED'
        ? 'A criar um novo pedido com os ajustes definidos...'
        : 'A guardar ajustes do pedido...',
    );

    try {
      if (request.status === 'EXPIRED') {
        const recreated = await recreateServiceRequest(accessToken, request.id, {
          title: normalizedTitle,
          description: normalizedDescription,
          location: normalizedLocation || '',
        });
        setStatus('Novo pedido criado com os ajustes definidos.');
        setShowAdjustForm(false);
        router.push(`/app/pedidos/${recreated.id}`);
        return;
      }

      await updateServiceRequest(accessToken, request.id, {
        title: normalizedTitle,
        description: normalizedDescription,
        location: normalizedLocation || '',
        ...(extendHours > 0 ? { extendExpiryHours: extendHours } : {}),
      });

      await loadDetails(accessToken);
      setExtendExpiryHours('0');
      setShowAdjustForm(false);
      setStatus('Pedido ajustado com sucesso.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao ajustar pedido.'));
    } finally {
      setAdjustingRequest(false);
    }
  }

  async function handleCreateReview() {
    if (!accessToken || !request?.job) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setSubmittingReview(true);
    setStatus('A enviar avaliação...');

    try {
      await createReview(accessToken, {
        jobId: request.job.id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      await loadDetails(accessToken);
      setStatus('Avaliação enviada com sucesso.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao enviar avaliação.'));
    } finally {
      setSubmittingReview(false);
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
                <div>
                  <dt className='inline font-medium text-slate-700'>Validade:</dt>{' '}
                  <dd className='inline'>{formatRequestExpiryText(request)}</dd>
                </div>
                {request.lastCustomerEditAt ? (
                  <div>
                    <dt className='inline font-medium text-slate-700'>
                      Último ajuste:
                    </dt>{' '}
                    <dd className='inline'>
                      {formatDateTime(request.lastCustomerEditAt)}
                    </dd>
                  </div>
                ) : null}
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

          <section className='grid gap-4 xl:grid-cols-[1.1fr,0.9fr]'>
            <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                    Operação do pedido
                  </p>
                  <h2 className='mt-2 text-lg font-semibold text-slate-900'>
                    Visibilidade de convites e resposta
                  </h2>
                  <p className='mt-1 text-sm text-slate-600'>
                    Acompanha quem já foi convidado, quem já abriu o pedido e quem
                    ainda não respondeu.
                  </p>
                </div>
                <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'>
                  {operationalSnapshot?.proposalsReceived ?? 0} proposta(s)
                </span>
              </div>

              <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                  <p className='text-xs text-slate-500'>Convites enviados</p>
                  <p className='mt-1 text-lg font-semibold text-slate-900'>
                    {operationalSnapshot?.totalInvitations ?? 0}
                  </p>
                </div>
                <div className='rounded-xl border border-amber-200 bg-amber-50 p-3'>
                  <p className='text-xs text-amber-700'>Já viram</p>
                  <p className='mt-1 text-lg font-semibold text-amber-800'>
                    {operationalSnapshot?.seenInvitations ?? 0}
                  </p>
                </div>
                <div className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
                  <p className='text-xs text-blue-700'>Ainda sem resposta</p>
                  <p className='mt-1 text-lg font-semibold text-blue-800'>
                    {operationalSnapshot?.pendingInvitations ?? 0}
                  </p>
                </div>
                <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-3'>
                  <p className='text-xs text-emerald-700'>Convites convertidos</p>
                  <p className='mt-1 text-lg font-semibold text-emerald-800'>
                    {operationalSnapshot?.acceptedInvitations ?? 0}
                  </p>
                </div>
              </div>

              <div className='mt-4 grid gap-3 lg:grid-cols-2'>
                <div className='rounded-2xl border border-slate-200 bg-slate-50 p-4'>
                  <p className='text-sm font-semibold text-slate-900'>
                    Pendentes agora
                  </p>
                  <p className='mt-1 text-sm text-slate-600'>
                    {operationalSnapshot?.pendingInvitations
                      ? `${operationalSnapshot.pendingInvitations} convite(s) continuam sem resposta.`
                      : 'Não há convites pendentes neste momento.'}
                  </p>
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {(operationalSnapshot?.waitingProviders ?? []).length > 0 ? (
                      operationalSnapshot?.waitingProviders.map(
                        (providerName, index) => (
                        <span
                          key={`${providerName}-${index}`}
                          className='rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200'
                        >
                          {providerName}
                        </span>
                        ),
                      )
                    ) : (
                      <span className='text-sm text-slate-500'>
                        Sem pendências abertas.
                      </span>
                    )}
                  </div>
                </div>

                <div className='rounded-2xl border border-slate-200 bg-slate-50 p-4'>
                  <p className='text-sm font-semibold text-slate-900'>
                    Já viram, mas ainda não responderam
                  </p>
                  <p className='mt-1 text-sm text-slate-600'>
                    {operationalSnapshot?.seenPendingInvitations
                      ? `${operationalSnapshot.seenPendingInvitations} convite(s) já foram abertos do lado do prestador.`
                      : 'Ainda não há convites vistos sem resposta.'}
                  </p>
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {(operationalSnapshot?.waitingSeenProviders ?? []).length > 0 ? (
                      operationalSnapshot?.waitingSeenProviders.map(
                        (providerName, index) => (
                          <span
                            key={`${providerName}-${index}`}
                            className='rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200'
                          >
                            {providerName}
                          </span>
                        ),
                      )
                    ) : (
                      <span className='text-sm text-slate-500'>
                        Sem visualizações pendentes por resolver.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                Histórico operacional
              </p>
              <h2 className='mt-2 text-lg font-semibold text-slate-900'>
                Linha do tempo do pedido
              </h2>
              <div className='mt-4 space-y-3'>
                {requestActivity.length > 0 ? (
                  requestActivity.slice(0, 12).map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-2xl border p-3 ${getActivityToneClass(
                        item.tone,
                      )}`}
                    >
                      <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'>
                        <div>
                          <p className='text-sm font-semibold'>{item.title}</p>
                          <p className='mt-1 text-sm opacity-80'>
                            {item.description}
                          </p>
                        </div>
                        <span className='text-xs font-medium opacity-70'>
                          {formatDateTime(item.occurredAt)}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className='text-sm text-slate-600'>
                    O histórico operacional vai aparecer aqui assim que o pedido
                    ganhar convites, propostas ou ajustes.
                  </p>
                )}
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
                    Profissionais sugeridos para a tua zona
                  </h2>
                  <p className='mt-1 max-w-3xl text-sm text-slate-600'>
                    {request.location
                      ? 'Usamos a localidade do teu pedido para dar prioridade a perfis da mesma cidade, zona ou áreas próximas. Quando não há correspondência suficiente, alargamos a procura.'
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
                            Enviado em {formatDateTime(invitation.createdAt)}
                          </p>
                          <p className='mt-2 text-sm text-slate-600'>
                            {invitation.status === 'SENT'
                              ? invitation.openedAt
                                ? `Viu o convite em ${formatDateTime(invitation.openedAt)} e ainda não respondeu.`
                                : 'Convite ainda não aberto pelo prestador.'
                              : invitation.respondedAt
                                ? `${invitationStatusLabel[invitation.status] ?? invitation.status} em ${formatDateTime(invitation.respondedAt)}.`
                                : invitation.openedAt
                                  ? `Viu o convite em ${formatDateTime(invitation.openedAt)}.`
                                  : 'Sem nova atividade neste convite.'}
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
                      ? 'Ainda não encontrámos perfis da mesma cidade, zona ou áreas próximas. Continuamos a procurar dentro desta área.'
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
                  const relatedInvitation = invitationByProviderUserId.get(
                    proposal.providerId,
                  );

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
                            {resolveProposalProviderName(proposal)}
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
                              ? `${formatRatingValue(
                                  proposal.provider.workerProfile.ratingAvg,
                                )} (${proposal.provider.workerProfile.ratingCount})`
                              : 'n/d'}
                          </p>
                          <p className='text-xs text-slate-500'>
                            Recebida em {formatDateTime(proposal.createdAt)}
                          </p>
                          <p className='text-xs text-slate-500'>
                            Origem:{' '}
                            {relatedInvitation ? 'Convite direto' : 'Mercado aberto'}
                          </p>
                          {relatedInvitation?.openedAt ? (
                            <p className='text-xs text-slate-500'>
                              Convite visto em {formatDateTime(relatedInvitation.openedAt)}
                            </p>
                          ) : null}
                        </div>

                        <div className='flex flex-wrap items-center gap-2'>
                          {relatedInvitation ? (
                            <span className='rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700'>
                              Via convite
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getProposalBadgeClass(
                              isSelected ? 'SELECTED' : proposal.status,
                            )}`}
                          >
                            {isSelected
                              ? 'Selecionada'
                              : proposalStatusLabel[proposal.status] ?? proposal.status}
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

          {canAdjustRequest ? (
            <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                    Ajustar pedido
                  </p>
                  <h2 className='mt-2 text-lg font-semibold text-slate-900'>
                    {request.status === 'EXPIRED'
                      ? 'Reabrir com mais controlo'
                      : 'Afinar o pedido sem perder histórico'}
                  </h2>
                  <p className='mt-1 max-w-3xl text-sm text-slate-600'>
                    {request.status === 'EXPIRED'
                      ? 'Podes criar um novo pedido a partir deste, já com o texto e a localização ajustados para melhorar a próxima ronda.'
                      : 'Atualiza título, descrição, localização e, se precisares, adiciona mais horas de resposta sem quebrar o histórico atual.'}
                  </p>
                </div>

                <button
                  type='button'
                  className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                  onClick={() => setShowAdjustForm((current) => !current)}
                >
                  {showAdjustForm ? 'Fechar ajustes' : 'Abrir ajustes'}
                </button>
              </div>

              {showAdjustForm ? (
                <form
                  className='mt-4 space-y-4'
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAdjustRequest();
                  }}
                >
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <label className='space-y-1 text-sm text-slate-700 sm:col-span-2'>
                      <span>Título</span>
                      <input
                        type='text'
                        value={adjustTitle}
                        onChange={(event) => setAdjustTitle(event.target.value)}
                        minLength={3}
                        maxLength={140}
                        className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                        required
                      />
                    </label>

                    <label className='space-y-1 text-sm text-slate-700 sm:col-span-2'>
                      <span>Descrição</span>
                      <textarea
                        value={adjustDescription}
                        onChange={(event) =>
                          setAdjustDescription(event.target.value)
                        }
                        minLength={10}
                        maxLength={2000}
                        className='min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                        required
                      />
                    </label>

                    <label className='space-y-1 text-sm text-slate-700'>
                      <span>Localização</span>
                      <input
                        type='text'
                        value={adjustLocation}
                        onChange={(event) =>
                          setAdjustLocation(event.target.value)
                        }
                        maxLength={240}
                        className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                        placeholder='Cidade, bairro ou zona'
                      />
                    </label>

                    {request.status === 'OPEN' ? (
                      <label className='space-y-1 text-sm text-slate-700'>
                        <span>Adicionar prazo</span>
                        <select
                          value={extendExpiryHours}
                          onChange={(event) =>
                            setExtendExpiryHours(event.target.value)
                          }
                          className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                        >
                          <option value='0'>Sem extensão</option>
                          <option value='12'>+12 horas</option>
                          <option value='24'>+24 horas</option>
                          <option value='48'>+48 horas</option>
                          <option value='72'>+72 horas</option>
                        </select>
                      </label>
                    ) : null}
                  </div>

                  <div className='rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600'>
                    {request.proposals?.length
                      ? 'Os ajustes mantêm o histórico já recebido. Prestadores convidados continuam visíveis e podem reagir com base na versão atualizada.'
                      : 'Este ajuste ajuda a tornar o pedido mais claro antes da próxima resposta chegar.'}
                  </div>

                  <div className='flex flex-wrap items-center gap-3'>
                    <button
                      type='submit'
                      className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                      disabled={adjustingRequest}
                    >
                      {adjustingRequest
                        ? request.status === 'EXPIRED'
                          ? 'A criar...'
                          : 'A guardar...'
                        : request.status === 'EXPIRED'
                          ? 'Criar novo pedido ajustado'
                          : 'Guardar ajustes'}
                    </button>

                    <button
                      type='button'
                      className='inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                      onClick={() => {
                        setAdjustTitle(request.title);
                        setAdjustDescription(request.description);
                        setAdjustLocation(request.location ?? '');
                        setExtendExpiryHours('0');
                      }}
                      disabled={adjustingRequest}
                    >
                      Repor campos
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          ) : null}

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

            {request.status === 'EXPIRED' ? (
              <div className='mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700'>
                <p className='font-semibold'>Pedido expirado</p>
                <p className='mt-1'>
                  O pedido deixou de aceitar propostas dentro do SLA atual. Para
                  continuar, cria um novo pedido igual ou abre a área de ajustes
                  abaixo para o relançar com mais contexto.
                </p>
              </div>
            ) : canReviewRequest ? (
              <div className='mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800'>
                <p className='font-semibold'>Avaliação pendente</p>
                <p className='mt-1'>
                  {selectedProposal?.provider?.name ?? 'O prestador selecionado'}{' '}
                  concluiu o trabalho. A tua avaliação fecha o ciclo do pedido e
                  atualiza a reputação pública do perfil.
                </p>
              </div>
            ) : existingReview ? (
              <div className='mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'>
                <p className='font-semibold'>Avaliação registada</p>
                <p className='mt-1'>
                  Deste {existingReview.rating}/5 a{' '}
                  {selectedProposal?.provider?.name ?? 'este prestador'}.
                </p>
                <p className='mt-2 text-emerald-700'>
                  Enviada em {new Date(existingReview.createdAt).toLocaleString('pt-PT')}
                </p>
              </div>
            ) : jobDetails?.contactUnlocked ? (
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

            {request.status === 'EXPIRED' ? (
              <div className='mt-4 flex flex-wrap items-center gap-3'>
                <button
                  type='button'
                  className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                  onClick={() => {
                    void handleRecreateRequest();
                  }}
                  disabled={recreatingRequest}
                >
                  {recreatingRequest ? 'A criar...' : 'Criar novo pedido igual'}
                </button>

                <Link
                  href='/app/pedidos'
                  className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                >
                  Voltar aos pedidos
                </Link>
              </div>
            ) : canReviewRequest ? (
              <div className='mt-4 flex flex-wrap items-center gap-3'>
                <a
                  href='#avaliacao'
                  className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700'
                >
                  Avaliar agora
                </a>
              </div>
            ) : payableIntent ? (
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

          {request.job && financial ? (
            <JobProtectionPanel
              accessToken={accessToken ?? ''}
              jobId={request.job.id}
              financial={financial}
              viewerRole='customer'
              onRefresh={async () => {
                if (!accessToken) {
                  return;
                }

                await loadDetails(accessToken);
              }}
              onStatusChange={setStatus}
              showOpenRequestLink={{
                href: `/app/mensagens?job=${request.job.id}`,
                label: 'Abrir mensagens do job',
              }}
            />
          ) : null}

          {request.job?.status === 'COMPLETED' ? (
            <section
              id='avaliacao'
              className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
            >
              <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                Avaliação
              </p>
              <h2 className='mt-2 text-lg font-semibold text-slate-900'>
                {existingReview ? 'Avaliação enviada' : 'Como correu o serviço?'}
              </h2>
              <p className='mt-2 text-sm text-slate-600'>
                {existingReview
                  ? 'A tua avaliação já foi registada e já conta para a reputação do prestador.'
                  : 'Partilha a tua experiência com um rating simples e, se quiseres, um comentário curto.'}
              </p>

              {existingReview ? (
                <div className='mt-4 grid gap-3 sm:grid-cols-3'>
                  <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
                    <p className='text-xs text-slate-500'>Rating enviado</p>
                    <p className='mt-1 text-sm font-semibold text-slate-900'>
                      {existingReview.rating}/5
                    </p>
                  </div>
                  <div className='rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2'>
                    <p className='text-xs text-slate-500'>Comentário</p>
                    <p className='mt-1 text-sm text-slate-700'>
                      {existingReview.comment ?? 'Sem comentário adicional.'}
                    </p>
                  </div>
                </div>
              ) : (
                <form
                  className='mt-4 space-y-4'
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleCreateReview();
                  }}
                >
                  <div>
                    <p className='text-sm font-medium text-slate-700'>Rating</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {[1, 2, 3, 4, 5].map((value) => {
                        const isSelected = reviewRating === value;

                        return (
                          <button
                            key={value}
                            type='button'
                            className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                            onClick={() => setReviewRating(value)}
                          >
                            {value}/5
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className='block space-y-2 text-sm text-slate-700'>
                    <span>Comentário (opcional)</span>
                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      maxLength={1000}
                      className='min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                      placeholder='Ex.: comunicação clara, chegou a horas e resolveu o problema.'
                    />
                  </label>

                  <div className='flex flex-wrap items-center gap-3'>
                    <button
                      type='submit'
                      className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                      disabled={submittingReview}
                    >
                      {submittingReview ? 'A enviar...' : 'Enviar avaliação'}
                    </button>
                    <p className='text-sm text-slate-500'>
                      Esta avaliação só pode ser enviada uma vez.
                    </p>
                  </div>
                </form>
              )}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
