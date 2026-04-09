import {
  ProviderProposalFeedItem,
  ProviderRequestInvitation,
  ServiceRequest,
} from '@/lib/service-requests';
import {
  buildLocationMatch,
  type LocationMatch,
} from '@/lib/request-worker-recommendations';
import { WorkerProfile } from '@/lib/worker-profile';
import type {
  InboxNotification as ProviderInboxNotification,
  InboxNotificationTone as ProviderInboxNotificationTone,
} from '@/lib/notifications';

export type {
  ProviderInboxNotification,
  ProviderInboxNotificationTone,
};

export type ProviderInboxNotificationKind =
  | 'pending_invitations'
  | 'selected_proposals'
  | 'awaiting_proposals'
  | 'open_market_requests'
  | 'rejected_proposals';

export type ProviderRequestPriority = 'high' | 'medium' | 'low';

export type ProviderRequestFit = {
  requestId: string;
  score: number;
  priority: ProviderRequestPriority;
  priorityLabel: string;
  categoryLabel: string;
  geographicLabel: string;
  availabilityLabel: string;
  historyLabel: string;
  suggestionPrice: number | null;
  suggestionComment: string;
  suggestionReason: string;
  isDirectInvite: boolean;
};

type ProviderInboxInput = {
  requests: ServiceRequest[];
  invitations: ProviderRequestInvitation[];
  proposals: ProviderProposalFeedItem[];
  providerProfile?: WorkerProfile | null;
};

type RequestSnapshot = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  location: string | null;
  expiresAt: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
};

type HistoryFit = {
  score: number;
  label: string;
};

type AvailabilityFit = {
  score: number;
  label: string;
};

type GeographicFit = LocationMatch & {
  referenceArea: string | null;
};

type SuggestionSource = {
  price: number | null;
  reason: string;
};

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime(),
  );
}

function sortRequestsByFit<T>(
  items: T[],
  fitByRequestId: Map<string, ProviderRequestFit>,
  getRequest: (item: T) => RequestSnapshot,
): T[] {
  return [...items].sort((left, right) => {
    const leftRequest = getRequest(left);
    const rightRequest = getRequest(right);
    const leftFit = fitByRequestId.get(leftRequest.id);
    const rightFit = fitByRequestId.get(rightRequest.id);
    const scoreDiff = (rightFit?.score ?? 0) - (leftFit?.score ?? 0);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return (
      new Date(rightRequest.expiresAt).getTime() -
      new Date(leftRequest.expiresAt).getTime()
    );
  });
}

function resolveRequestCategoryLabel(request: RequestSnapshot) {
  return request.category?.name ?? 'esta categoria';
}

function matchesProviderCategory(
  request: RequestSnapshot,
  profile: WorkerProfile | null | undefined,
) {
  if (!profile) {
    return false;
  }

  if (request.category?.slug) {
    return profile.categories.some((category) => category.slug === request.category?.slug);
  }

  return profile.categories.some((category) => category.id === request.categoryId);
}

function resolveAvailabilityFit(
  request: RequestSnapshot,
  profile: WorkerProfile | null | undefined,
): AvailabilityFit {
  if (!profile) {
    return {
      score: 0,
      label: 'Completa o perfil para afinar prioridade',
    };
  }

  const hoursUntilExpiry =
    (new Date(request.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000);

  if (profile.availabilityStatus === 'UNAVAILABLE') {
    return {
      score: -4,
      label: 'Perfil marcado como indisponivel',
    };
  }

  if (profile.availabilityStatus === 'NEXT_WEEK') {
    return {
      score: hoursUntilExpiry >= 72 ? 1 : -1,
      label: 'Entrada prevista para a proxima semana',
    };
  }

  if (profile.availabilityStatus === 'LIMITED_THIS_WEEK') {
    return {
      score: hoursUntilExpiry >= 24 ? 2 : 1,
      label: 'Agenda limitada esta semana',
    };
  }

  return {
    score: hoursUntilExpiry <= 24 ? 4 : 3,
    label: 'Disponivel agora para responder rapido',
  };
}

function resolveGeographicFit(
  request: RequestSnapshot,
  profile: WorkerProfile | null | undefined,
): GeographicFit {
  if (!profile) {
    return {
      score: 0,
      tier: 'location-pending',
      label: 'Zona ainda sem preferencia definida',
      referenceArea: null,
    };
  }

  const candidateAreas = [
    profile.location,
    ...profile.serviceAreaPreferences,
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));

  if (candidateAreas.length === 0) {
    return {
      score: 0,
      tier: 'location-pending',
      label: 'Define localizacao e zonas preferidas',
      referenceArea: null,
    };
  }

  let bestMatch: GeographicFit = {
    score: 0,
    tier: 'location-pending',
    label: 'Mais amplo',
    referenceArea: candidateAreas[0] ?? null,
  };

  candidateAreas.forEach((area) => {
    const match = buildLocationMatch(request.location, area);
    if (match.score > bestMatch.score) {
      bestMatch = {
        ...match,
        referenceArea: area,
      };
    }
  });

  return bestMatch;
}

function resolveHistoryFit(
  request: RequestSnapshot,
  proposals: ProviderProposalFeedItem[],
): HistoryFit {
  const sameCategory = proposals.filter(
    (proposal) => proposal.request.categoryId === request.categoryId,
  );

  if (sameCategory.length === 0) {
    return {
      score: 0,
      label: 'Sem historico previo nesta categoria',
    };
  }

  const selectedCount = sameCategory.filter(
    (proposal) => proposal.status === 'SELECTED',
  ).length;
  const sameAreaSelectedCount = sameCategory.filter(
    (proposal) =>
      proposal.status === 'SELECTED' &&
      buildLocationMatch(request.location, proposal.request.location).score >= 2,
  ).length;

  if (sameAreaSelectedCount > 0) {
    return {
      score: 4,
      label: 'Ja foste escolhido em pedidos parecidos nesta zona',
    };
  }

  if (selectedCount > 0) {
    return {
      score: 3,
      label: 'Ja tens pedidos ganhos nesta categoria',
    };
  }

  return {
    score: 1,
    label: 'Ja respondeste a pedidos desta categoria',
  };
}

function getMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex];
  }

  return Math.round((sorted[middleIndex - 1] + sorted[middleIndex]) / 2);
}

function resolveSuggestedPrice(
  request: RequestSnapshot,
  profile: WorkerProfile | null | undefined,
  proposals: ProviderProposalFeedItem[],
): SuggestionSource {
  const sameCategory = proposals.filter(
    (proposal) =>
      proposal.request.categoryId === request.categoryId &&
      proposal.status !== 'REJECTED',
  );
  const sameArea = sameCategory.filter(
    (proposal) => buildLocationMatch(request.location, proposal.request.location).score >= 2,
  );

  const sameAreaPrice = getMedian(sameArea.map((proposal) => proposal.price));
  if (sameAreaPrice !== null) {
    return {
      price: sameAreaPrice,
      reason: 'Baseado no teu historico em pedidos parecidos desta zona',
    };
  }

  const sameCategoryPrice = getMedian(
    sameCategory.map((proposal) => proposal.price),
  );
  if (sameCategoryPrice !== null) {
    return {
      price: sameCategoryPrice,
      reason: 'Baseado nas tuas ultimas propostas desta categoria',
    };
  }

  if (typeof profile?.hourlyRate === 'number' && profile.hourlyRate > 0) {
    return {
      price: profile.hourlyRate * 4,
      reason: 'Baseado na tua tarifa/hora atual como ponto de partida',
    };
  }

  return {
    price: null,
    reason: 'Sem base suficiente para sugerir preco automatico',
  };
}

function buildSuggestedComment(input: {
  request: RequestSnapshot;
  profile: WorkerProfile | null | undefined;
  availabilityLabel: string;
  historyLabel: string;
  isDirectInvite: boolean;
}) {
  const greeting = input.isDirectInvite ? 'Obrigado pelo convite.' : 'Ola!';
  const locationPart = input.request.location
    ? ` para ${input.request.location}`
    : '';
  const categoryPart = resolveRequestCategoryLabel(input.request).toLowerCase();
  const providerName = input.profile?.publicName || input.profile?.displayName;
  const signature = providerName ? ` ${providerName}.` : '';

  return `${greeting} Tenho disponibilidade para responder a este pedido de ${categoryPart}${locationPart}. ${input.availabilityLabel}. ${input.historyLabel}. Posso alinhar detalhes e avancar com uma proposta objetiva.${signature}`;
}

function buildRequestFit(input: {
  request: RequestSnapshot;
  profile: WorkerProfile | null | undefined;
  proposals: ProviderProposalFeedItem[];
  isDirectInvite: boolean;
}): ProviderRequestFit {
  const categoryMatch = matchesProviderCategory(input.request, input.profile);
  const categoryScore =
    !input.profile || input.profile.categories.length === 0
      ? 0
      : categoryMatch
        ? 4
        : -2;
  const categoryLabel = categoryMatch
    ? 'Categoria alinhada com o teu perfil'
    : input.profile?.categories.length
      ? 'Fora das categorias principais do teu perfil'
      : 'Completa categorias para filtrar melhor';

  const geographicFit = resolveGeographicFit(input.request, input.profile);
  const geographicLabel = geographicFit.referenceArea
    ? `${geographicFit.label} via ${geographicFit.referenceArea}`
    : geographicFit.label;
  const availabilityFit = resolveAvailabilityFit(input.request, input.profile);
  const historyFit = resolveHistoryFit(input.request, input.proposals);
  const urgencyScore =
    new Date(input.request.expiresAt).getTime() - Date.now() <= 24 * 60 * 60 * 1000
      ? 1
      : 0;
  const inviteScore = input.isDirectInvite ? 4 : 0;
  const totalScore =
    categoryScore +
    geographicFit.score +
    availabilityFit.score +
    historyFit.score +
    inviteScore +
    urgencyScore;

  const priority: ProviderRequestPriority =
    totalScore >= 12 ? 'high' : totalScore >= 8 ? 'medium' : 'low';
  const priorityLabel =
    priority === 'high'
      ? 'Alta prioridade'
      : priority === 'medium'
        ? 'Boa combinacao'
        : 'Explorar depois';
  const suggestion = resolveSuggestedPrice(
    input.request,
    input.profile,
    input.proposals,
  );

  return {
    requestId: input.request.id,
    score: totalScore,
    priority,
    priorityLabel,
    categoryLabel,
    geographicLabel,
    availabilityLabel: availabilityFit.label,
    historyLabel: historyFit.label,
    suggestionPrice: suggestion.price,
    suggestionComment: buildSuggestedComment({
      request: input.request,
      profile: input.profile,
      availabilityLabel: availabilityFit.label,
      historyLabel: historyFit.label,
      isDirectInvite: input.isDirectInvite,
    }),
    suggestionReason: suggestion.reason,
    isDirectInvite: input.isDirectInvite,
  };
}

export function buildProviderInboxModel(input: ProviderInboxInput) {
  const invitationByRequestId = new Map(
    input.invitations.map((invitation) => [invitation.request.id, invitation]),
  );
  const requestFitById = new Map<string, ProviderRequestFit>();

  input.invitations.forEach((invitation) => {
    requestFitById.set(
      invitation.request.id,
      buildRequestFit({
        request: invitation.request,
        profile: input.providerProfile,
        proposals: input.proposals,
        isDirectInvite: true,
      }),
    );
  });

  input.requests.forEach((request) => {
    if (!requestFitById.has(request.id)) {
      requestFitById.set(
        request.id,
        buildRequestFit({
          request,
          profile: input.providerProfile,
          proposals: input.proposals,
          isDirectInvite: false,
        }),
      );
    }
  });

  const pendingInvitations = sortRequestsByFit(
    input.invitations.filter((invitation) => invitation.status === 'SENT'),
    requestFitById,
    (invitation) => invitation.request,
  );

  const openMarketRequests = sortRequestsByFit(
    input.requests.filter(
      (request) =>
        !invitationByRequestId.has(request.id) &&
        (request.proposals?.length ?? 0) === 0,
    ),
    requestFitById,
    (request) => request,
  );

  const awaitingProposals = sortByDateDesc(
    input.proposals.filter((proposal) => proposal.status === 'SUBMITTED'),
    (proposal) => proposal.updatedAt,
  );

  const selectedProposals = sortByDateDesc(
    input.proposals.filter((proposal) => proposal.status === 'SELECTED'),
    (proposal) => proposal.updatedAt,
  );

  const rejectedProposals = sortByDateDesc(
    input.proposals.filter((proposal) => proposal.status === 'REJECTED'),
    (proposal) => proposal.updatedAt,
  );

  const directInviteProposals = input.proposals.filter((proposal) =>
    Boolean(proposal.request.invitation),
  );
  const openMarketProposals = input.proposals.filter(
    (proposal) => !proposal.request.invitation,
  );

  const notifications: ProviderInboxNotification[] = [];

  if (pendingInvitations.length > 0) {
    const highPriorityInvitations = pendingInvitations.filter(
      (invitation) =>
        requestFitById.get(invitation.request.id)?.priority === 'high',
    ).length;

    notifications.push({
      id: 'pending_invitations',
      kind: 'pending_invitations',
      title: `${pendingInvitations.length} convite(s) por responder`,
      description:
        highPriorityInvitations > 0
          ? `${highPriorityInvitations} convite(s) aparecem com alta prioridade pelo teu perfil atual.`
          : 'Clientes pediram diretamente a tua proposta. Responde primeiro a estes pedidos.',
      href: '/pro/pedidos#convites',
      hrefLabel: 'Ver convites',
      tone: 'attention',
    });
  }

  if (selectedProposals.length > 0) {
    notifications.push({
      id: 'selected_proposals',
      kind: 'selected_proposals',
      title: `${selectedProposals.length} proposta(s) selecionada(s)`,
      description:
        'Ja tens pedidos que avancaram contigo. Confirma os proximos passos no fluxo.',
      href: '/pro/propostas#selecionadas',
      hrefLabel: 'Ver selecionadas',
      tone: 'success',
    });
  }

  if (awaitingProposals.length > 0) {
    notifications.push({
      id: 'awaiting_proposals',
      kind: 'awaiting_proposals',
      title: `${awaitingProposals.length} proposta(s) em analise`,
      description:
        'Clientes ainda estao a decidir. Mantem-te atento a mudancas de estado.',
      href: '/pro/propostas#aguardando',
      hrefLabel: 'Acompanhar propostas',
      tone: 'info',
    });
  }

  if (openMarketRequests.length > 0) {
    const topFit = openMarketRequests
      .map((request) => requestFitById.get(request.id))
      .filter((item): item is ProviderRequestFit => Boolean(item))
      .filter((item) => item.priority === 'high').length;

    notifications.push({
      id: 'open_market_requests',
      kind: 'open_market_requests',
      title: `${openMarketRequests.length} pedido(s) no mercado aberto`,
      description:
        topFit > 0
          ? `${topFit} pedido(s) do mercado aberto aparecem com prioridade alta para ti.`
          : 'Ha oportunidades sem convite direto e ainda sem tua proposta.',
      href: '/pro/pedidos#mercado',
      hrefLabel: 'Ver mercado aberto',
      tone: 'info',
    });
  }

  if (rejectedProposals.length > 0) {
    notifications.push({
      id: 'rejected_proposals',
      kind: 'rejected_proposals',
      title: `${rejectedProposals.length} proposta(s) nao selecionada(s)`,
      description:
        'Alguns pedidos seguiram com outro prestador. Reves o contexto para ajustar futuras propostas.',
      href: '/pro/propostas#nao-selecionadas',
      hrefLabel: 'Ver historico',
      tone: 'muted',
    });
  }

  return {
    invitationByRequestId,
    requestFitById,
    pendingInvitations,
    openMarketRequests,
    awaitingProposals,
    selectedProposals,
    rejectedProposals,
    directInviteProposals,
    openMarketProposals,
    notifications,
  };
}
