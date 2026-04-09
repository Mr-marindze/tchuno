import {
  ProviderProposalFeedItem,
  ProviderRequestInvitation,
  ServiceRequest,
} from '@/lib/service-requests';
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

type ProviderInboxInput = {
  requests: ServiceRequest[];
  invitations: ProviderRequestInvitation[];
  proposals: ProviderProposalFeedItem[];
};

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(getDate(right)).getTime() - new Date(getDate(left)).getTime(),
  );
}

export function buildProviderInboxModel(input: ProviderInboxInput) {
  const invitationByRequestId = new Map(
    input.invitations.map((invitation) => [invitation.request.id, invitation]),
  );

  const pendingInvitations = sortByDateDesc(
    input.invitations.filter((invitation) => invitation.status === 'SENT'),
    (invitation) => invitation.createdAt,
  );

  const openMarketRequests = sortByDateDesc(
    input.requests.filter(
      (request) =>
        !invitationByRequestId.has(request.id) &&
        (request.proposals?.length ?? 0) === 0,
    ),
    (request) => request.createdAt,
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
    notifications.push({
      id: 'pending_invitations',
      kind: 'pending_invitations',
      title: `${pendingInvitations.length} convite(s) por responder`,
      description:
        'Clientes pediram diretamente a tua proposta. Responde primeiro a estes pedidos.',
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
        'Já tens pedidos que avançaram contigo. Confirma os próximos passos no fluxo.',
      href: '/pro/propostas#selecionadas',
      hrefLabel: 'Ver selecionadas',
      tone: 'success',
    });
  }

  if (awaitingProposals.length > 0) {
    notifications.push({
      id: 'awaiting_proposals',
      kind: 'awaiting_proposals',
      title: `${awaitingProposals.length} proposta(s) em análise`,
      description:
        'Clientes ainda estão a decidir. Mantém-te atento a mudanças de estado.',
      href: '/pro/propostas#aguardando',
      hrefLabel: 'Acompanhar propostas',
      tone: 'info',
    });
  }

  if (openMarketRequests.length > 0) {
    notifications.push({
      id: 'open_market_requests',
      kind: 'open_market_requests',
      title: `${openMarketRequests.length} pedido(s) no mercado aberto`,
      description:
        'Há oportunidades sem convite direto e ainda sem tua proposta.',
      href: '/pro/pedidos#mercado',
      hrefLabel: 'Ver mercado aberto',
      tone: 'info',
    });
  }

  if (rejectedProposals.length > 0) {
    notifications.push({
      id: 'rejected_proposals',
      kind: 'rejected_proposals',
      title: `${rejectedProposals.length} proposta(s) não selecionada(s)`,
      description:
        'Alguns pedidos seguiram com outro prestador. Revê o contexto para ajustar futuras propostas.',
      href: '/pro/propostas#nao-selecionadas',
      hrefLabel: 'Ver histórico',
      tone: 'muted',
    });
  }

  return {
    invitationByRequestId,
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
