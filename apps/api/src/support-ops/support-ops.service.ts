import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OperationalIncidentSeverity,
  OperationalIncidentSource,
  OperationalIncidentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationalIncidentDto } from './dto/create-operational-incident.dto';
import { ListOperationalIncidentsQueryDto } from './dto/list-operational-incidents-query.dto';
import { UpdateOperationalIncidentDto } from './dto/update-operational-incident.dto';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

const incidentInclude = {
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  ownerAdminUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  relatedJob: {
    select: {
      id: true,
      title: true,
      status: true,
      requestId: true,
    },
  },
  relatedRefundRequest: {
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      reason: true,
    },
  },
  relatedTrustSafetyIntervention: {
    select: {
      id: true,
      status: true,
      riskLevel: true,
      reasonSummary: true,
      jobId: true,
    },
  },
  events: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.OperationalIncidentInclude;

type IncidentEventCreateInput = Prisma.OperationalIncidentEventCreateManyInput;

function normalizeEvidenceItems(items?: string[] | null): string[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items
    .map((item) => item.trim())
    .filter(
      (item, index, array) => item.length > 0 && array.indexOf(item) === index,
    )
    .slice(0, 12);
}

function normalizeBaseSlaHours(value?: number | null): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 24;
  }

  return Math.max(1, Math.min(168, Math.trunc(numeric)));
}

function buildSlaTargetAt(detectedAt: Date, baseSlaHours: number) {
  return new Date(detectedAt.getTime() + baseSlaHours * 60 * 60 * 1000);
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function resolveDefaultSlaHours(input: {
  source: OperationalIncidentSource;
  severity: OperationalIncidentSeverity;
  override?: number | null;
}) {
  if (typeof input.override === 'number') {
    return normalizeBaseSlaHours(input.override);
  }

  if (
    input.source === 'PLATFORM' &&
    (input.severity === 'HIGH' || input.severity === 'CRITICAL')
  ) {
    return 8;
  }

  if (input.source === 'TRUST_SAFETY' && input.severity === 'HIGH') {
    return 12;
  }

  return 24;
}

@Injectable()
export class SupportOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async listIncidents(query: ListOperationalIncidentsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.OperationalIncidentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
    };
    const unresolvedWhere: Prisma.OperationalIncidentWhereInput = {
      status: {
        notIn: ['RESOLVED', 'CANCELED'],
      },
    };
    const now = new Date();

    const [
      total,
      data,
      unresolvedCount,
      criticalCount,
      resolvedCount,
      overdueCount,
    ] = await this.prisma.$transaction([
      this.prisma.operationalIncident.count({ where }),
      this.prisma.operationalIncident.findMany({
        where,
        include: incidentInclude,
        orderBy: [
          { status: 'asc' },
          { severity: 'desc' },
          { detectedAt: 'desc' },
          { id: 'desc' },
        ],
        take: limit,
        skip,
      }),
      this.prisma.operationalIncident.count({ where: unresolvedWhere }),
      this.prisma.operationalIncident.count({
        where: {
          ...unresolvedWhere,
          severity: {
            in: ['HIGH', 'CRITICAL'],
          },
        },
      }),
      this.prisma.operationalIncident.count({
        where: {
          status: 'RESOLVED',
        },
      }),
      this.prisma.operationalIncident.count({
        where: {
          ...unresolvedWhere,
          slaTargetAt: {
            lt: now,
          },
        },
      }),
    ]);

    return {
      ...buildPaginatedResponse({
        data,
        total,
        page,
        limit,
      }),
      summary: {
        unresolvedCount,
        criticalCount,
        resolvedCount,
        overdueCount,
      },
    };
  }

  async createIncident(actorUserId: string, dto: CreateOperationalIncidentDto) {
    await this.assertRelatedEntitiesExist(dto);

    const source = dto.source ?? 'SUPPORT';
    const severity = dto.severity ?? 'MEDIUM';
    const evidenceItems = normalizeEvidenceItems(dto.evidenceItems);
    const detectedAt = new Date();
    const baseSlaHours = resolveDefaultSlaHours({
      source,
      severity,
      override: dto.baseSlaHours,
    });
    const actorName = await this.resolveActorName(this.prisma, actorUserId);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.operationalIncident.create({
        data: {
          title: dto.title.trim(),
          summary: dto.summary.trim(),
          source,
          severity,
          baseSlaHours,
          slaTargetAt: buildSlaTargetAt(detectedAt, baseSlaHours),
          impactedArea: dto.impactedArea?.trim() || null,
          customerImpact: dto.customerImpact?.trim() || null,
          evidenceItems,
          createdByUserId: actorUserId,
          ownerAdminUserId: actorUserId,
          relatedJobId: dto.relatedJobId?.trim() || null,
          relatedRefundRequestId: dto.relatedRefundRequestId?.trim() || null,
          relatedTrustSafetyInterventionId:
            dto.relatedTrustSafetyInterventionId?.trim() || null,
          detectedAt,
          assumedAt: detectedAt,
        },
      });

      await this.createEvents(tx, [
        {
          incidentId: created.id,
          eventType: 'CASE_OPENED',
          visibility: 'INTERNAL',
          title: 'Caso criado',
          description: `Caso operacional aberto com SLA base de ${baseSlaHours}h.`,
          actorUserId,
          actorName,
        },
        {
          incidentId: created.id,
          eventType: 'OWNER_ASSIGNED',
          visibility: 'INTERNAL',
          title: 'Owner definido',
          description: `${actorName} ficou responsável pelo caso.`,
          actorUserId,
          actorName,
        },
        ...(evidenceItems.length > 0
          ? [
              {
                incidentId: created.id,
                eventType: 'EVIDENCE_ADDED' as const,
                visibility: 'INTERNAL' as const,
                title: 'Evidências registadas',
                description: `${evidenceItems.length} evidência(s) anexada(s) ao caso.`,
                actorUserId,
                actorName,
              },
            ]
          : []),
        ...(source === 'REFUND_DISPUTE' && dto.relatedRefundRequestId
          ? [
              {
                incidentId: created.id,
                eventType: 'CASE_OPENED' as const,
                visibility: 'PARTICIPANTS' as const,
                title: 'Caso aberto',
                description:
                  'A equipa de suporte abriu um caso para acompanhar a disputa.',
                actorUserId,
                actorName: 'Equipa de suporte',
              },
            ]
          : []),
      ]);

      return tx.operationalIncident.findUniqueOrThrow({
        where: { id: created.id },
        include: incidentInclude,
      });
    });
  }

  async updateIncident(
    incidentId: string,
    actorUserId: string,
    dto: UpdateOperationalIncidentDto,
  ) {
    const actorName = await this.resolveActorName(this.prisma, actorUserId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.operationalIncident.findUnique({
        where: { id: incidentId },
        include: incidentInclude,
      });

      if (!existing) {
        throw new NotFoundException('Operational incident not found');
      }

      const nextStatus = dto.status ?? existing.status;
      const isResolvedStatus =
        nextStatus === OperationalIncidentStatus.RESOLVED ||
        nextStatus === OperationalIncidentStatus.CANCELED;
      const nextBaseSlaHours =
        dto.baseSlaHours !== undefined
          ? normalizeBaseSlaHours(dto.baseSlaHours)
          : existing.baseSlaHours;
      const nextOwnerAdminUserId = dto.assignToMe
        ? actorUserId
        : existing.ownerAdminUserId;
      const nextEvidenceItems =
        dto.evidenceItems !== undefined
          ? normalizeEvidenceItems(dto.evidenceItems)
          : existing.evidenceItems;
      const nextResolutionNote =
        dto.resolutionNote !== undefined
          ? dto.resolutionNote.trim() || null
          : undefined;
      await tx.operationalIncident.update({
        where: { id: incidentId },
        data: {
          title: dto.title?.trim(),
          summary: dto.summary?.trim(),
          source: dto.source,
          severity: dto.severity,
          status: nextStatus,
          baseSlaHours:
            dto.baseSlaHours !== undefined ? nextBaseSlaHours : undefined,
          slaTargetAt:
            dto.baseSlaHours !== undefined
              ? buildSlaTargetAt(existing.detectedAt, nextBaseSlaHours)
              : undefined,
          impactedArea:
            dto.impactedArea !== undefined
              ? dto.impactedArea.trim() || null
              : undefined,
          customerImpact:
            dto.customerImpact !== undefined
              ? dto.customerImpact.trim() || null
              : undefined,
          evidenceItems:
            dto.evidenceItems !== undefined ? nextEvidenceItems : undefined,
          resolutionNote: nextResolutionNote,
          resolvedAt: isResolvedStatus
            ? (existing.resolvedAt ?? new Date())
            : nextStatus === existing.status
              ? existing.resolvedAt
              : null,
          ownerAdminUserId: nextOwnerAdminUserId,
          assumedAt: nextOwnerAdminUserId
            ? (existing.assumedAt ?? new Date())
            : existing.assumedAt,
        },
      });

      const events: IncidentEventCreateInput[] = [];
      const isParticipantCase = Boolean(existing.relatedRefundRequestId);

      if (
        nextOwnerAdminUserId &&
        nextOwnerAdminUserId !== existing.ownerAdminUserId
      ) {
        events.push({
          incidentId,
          eventType: 'OWNER_ASSIGNED',
          visibility: 'INTERNAL',
          title: 'Owner atualizado',
          description: `${actorName} assumiu o caso.`,
          actorUserId,
          actorName,
        });

        if (isParticipantCase) {
          events.push({
            incidentId,
            eventType: 'OWNER_ASSIGNED',
            visibility: 'PARTICIPANTS',
            title: 'Caso assumido',
            description:
              'A equipa de suporte assumiu o caso e iniciou o tratamento.',
            actorUserId,
            actorName: 'Equipa de suporte',
          });
        }
      }

      if (nextStatus !== existing.status) {
        const internalStatusEvent = this.buildInternalStatusEvent({
          incidentId,
          actorUserId,
          actorName,
          nextStatus,
          resolutionNote:
            nextResolutionNote !== undefined
              ? nextResolutionNote
              : existing.resolutionNote,
        });
        events.push(internalStatusEvent);

        if (isParticipantCase) {
          events.push(
            this.buildParticipantStatusEvent({
              incidentId,
              actorUserId,
              nextStatus,
              resolutionNote:
                nextResolutionNote !== undefined
                  ? nextResolutionNote
                  : existing.resolutionNote,
            }),
          );
        }
      }

      if (
        dto.baseSlaHours !== undefined &&
        nextBaseSlaHours !== existing.baseSlaHours
      ) {
        events.push({
          incidentId,
          eventType: 'SLA_UPDATED',
          visibility: 'INTERNAL',
          title: 'SLA base atualizado',
          description: `SLA base ajustado de ${existing.baseSlaHours}h para ${nextBaseSlaHours}h.`,
          actorUserId,
          actorName,
        });
      }

      if (
        dto.evidenceItems !== undefined &&
        !arraysEqual(existing.evidenceItems, nextEvidenceItems)
      ) {
        events.push({
          incidentId,
          eventType: 'EVIDENCE_ADDED',
          visibility: 'INTERNAL',
          title: 'Evidências atualizadas',
          description: `${nextEvidenceItems.length} evidência(s) registada(s) no caso.`,
          actorUserId,
          actorName,
        });
      }

      await this.createEvents(tx, events);

      return tx.operationalIncident.findUniqueOrThrow({
        where: { id: incidentId },
        include: incidentInclude,
      });
    });
  }

  async ensureRefundDisputeCase(
    client: PrismaClientLike,
    input: {
      refundRequestId: string;
      jobId: string;
      createdByUserId: string;
      actorName: string;
      amount: number;
      currency: string;
      reason: string;
      evidenceItems?: string[] | null;
      severity?: OperationalIncidentSeverity;
    },
  ) {
    const existing = await client.operationalIncident.findFirst({
      where: {
        relatedRefundRequestId: input.refundRequestId,
        status: {
          notIn: ['RESOLVED', 'CANCELED'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: incidentInclude,
    });

    if (existing) {
      return existing;
    }

    const evidenceItems = normalizeEvidenceItems(input.evidenceItems);
    const detectedAt = new Date();
    const baseSlaHours = 24;

    const created = await client.operationalIncident.create({
      data: {
        title: `Disputa financeira ${input.refundRequestId.slice(0, 8)}`,
        summary: `${input.reason.trim()}\n\nValor pedido: ${input.amount} ${input.currency}.`,
        source: 'REFUND_DISPUTE',
        severity:
          input.severity ?? (evidenceItems.length > 0 ? 'HIGH' : 'MEDIUM'),
        baseSlaHours,
        slaTargetAt: buildSlaTargetAt(detectedAt, baseSlaHours),
        impactedArea: 'Pagamentos e suporte',
        customerImpact:
          'A decisão fica visível no histórico do job assim que a análise terminar.',
        evidenceItems,
        createdByUserId: input.createdByUserId,
        relatedJobId: input.jobId,
        relatedRefundRequestId: input.refundRequestId,
        detectedAt,
      },
    });

    await this.createEvents(client, [
      {
        incidentId: created.id,
        eventType: 'CASE_OPENED',
        visibility: 'INTERNAL',
        title: 'Disputa criada',
        description: `${input.actorName} abriu uma disputa de ${input.amount} ${input.currency}.`,
        actorUserId: input.createdByUserId,
        actorName: input.actorName,
      },
      {
        incidentId: created.id,
        eventType: 'CASE_OPENED',
        visibility: 'PARTICIPANTS',
        title: 'Caso aberto',
        description: `${input.actorName} abriu o caso e a equipa vai analisar a disputa.`,
        actorUserId: input.createdByUserId,
        actorName: input.actorName,
      },
      ...(evidenceItems.length > 0
        ? [
            {
              incidentId: created.id,
              eventType: 'EVIDENCE_ADDED' as const,
              visibility: 'INTERNAL' as const,
              title: 'Evidências anexadas',
              description: `${evidenceItems.length} evidência(s) enviada(s) na abertura do caso.`,
              actorUserId: input.createdByUserId,
              actorName: input.actorName,
            },
            {
              incidentId: created.id,
              eventType: 'EVIDENCE_ADDED' as const,
              visibility: 'PARTICIPANTS' as const,
              title: 'Evidências anexadas',
              description: `${evidenceItems.length} evidência(s) ficaram registadas no caso.`,
              actorUserId: input.createdByUserId,
              actorName: input.actorName,
            },
          ]
        : []),
    ]);

    return client.operationalIncident.findUniqueOrThrow({
      where: { id: created.id },
      include: incidentInclude,
    });
  }

  async syncRefundCaseDecision(
    client: PrismaClientLike,
    input: {
      refundRequestId: string;
      refundStatus: RefundStatus;
      actorUserId?: string | null;
      actorName?: string | null;
      decisionNote?: string | null;
      decisionTitle?: string;
      closeTitle?: string;
    },
  ) {
    const incident = await client.operationalIncident.findFirst({
      where: {
        relatedRefundRequestId: input.refundRequestId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: incidentInclude,
    });

    if (!incident) {
      return null;
    }

    const isCanceled = input.refundStatus === 'CANCELED';
    const nextStatus: OperationalIncidentStatus = isCanceled
      ? 'CANCELED'
      : 'RESOLVED';
    const fallbackNote = this.buildRefundDecisionFallback(input.refundStatus);
    const decisionNote = input.decisionNote?.trim() || fallbackNote;
    const actorName = input.actorName?.trim() || 'Equipa de suporte';

    await client.operationalIncident.update({
      where: { id: incident.id },
      data: {
        status: nextStatus,
        resolutionNote: decisionNote,
        resolvedAt: incident.resolvedAt ?? new Date(),
      },
    });

    await this.createEvents(client, [
      {
        incidentId: incident.id,
        eventType: 'DECISION_RECORDED',
        visibility: 'INTERNAL',
        title: 'Decisão registada',
        description: decisionNote,
        actorUserId: input.actorUserId ?? null,
        actorName,
      },
      {
        incidentId: incident.id,
        eventType: 'DECISION_RECORDED',
        visibility: 'PARTICIPANTS',
        title:
          input.decisionTitle ??
          this.buildParticipantDecisionTitle(input.refundStatus),
        description: decisionNote,
        actorUserId: input.actorUserId ?? null,
        actorName: isCanceled ? actorName : 'Equipa de suporte',
      },
      {
        incidentId: incident.id,
        eventType: 'CASE_CLOSED',
        visibility: 'INTERNAL',
        title:
          input.closeTitle ??
          (nextStatus === 'CANCELED' ? 'Caso cancelado' : 'Caso encerrado'),
        description: decisionNote,
        actorUserId: input.actorUserId ?? null,
        actorName,
      },
      {
        incidentId: incident.id,
        eventType: 'CASE_CLOSED',
        visibility: 'PARTICIPANTS',
        title:
          input.closeTitle ??
          (nextStatus === 'CANCELED' ? 'Caso cancelado' : 'Caso encerrado'),
        description: decisionNote,
        actorUserId: input.actorUserId ?? null,
        actorName: isCanceled ? actorName : 'Equipa de suporte',
      },
    ]);

    return client.operationalIncident.findUniqueOrThrow({
      where: { id: incident.id },
      include: incidentInclude,
    });
  }

  private buildInternalStatusEvent(input: {
    incidentId: string;
    actorUserId: string;
    actorName: string;
    nextStatus: OperationalIncidentStatus;
    resolutionNote?: string | null;
  }): IncidentEventCreateInput {
    if (input.nextStatus === 'RESOLVED' || input.nextStatus === 'CANCELED') {
      return {
        incidentId: input.incidentId,
        eventType: 'CASE_CLOSED',
        visibility: 'INTERNAL',
        title:
          input.nextStatus === 'RESOLVED' ? 'Caso resolvido' : 'Caso cancelado',
        description:
          input.resolutionNote?.trim() ||
          (input.nextStatus === 'RESOLVED'
            ? 'Caso encerrado com sucesso.'
            : 'Caso encerrado sem ação adicional.'),
        actorUserId: input.actorUserId,
        actorName: input.actorName,
      };
    }

    return {
      incidentId: input.incidentId,
      eventType: 'STATUS_CHANGED',
      visibility: 'INTERNAL',
      title: 'Estado atualizado',
      description: `Caso movido para ${this.statusLabel(input.nextStatus)}.`,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    };
  }

  private buildParticipantStatusEvent(input: {
    incidentId: string;
    actorUserId: string;
    nextStatus: OperationalIncidentStatus;
    resolutionNote?: string | null;
  }): IncidentEventCreateInput {
    if (input.nextStatus === 'INVESTIGATING') {
      return {
        incidentId: input.incidentId,
        eventType: 'STATUS_CHANGED',
        visibility: 'PARTICIPANTS',
        title: 'Caso em investigação',
        description:
          'A equipa de suporte está a rever as evidências e o histórico do job.',
        actorUserId: input.actorUserId,
        actorName: 'Equipa de suporte',
      };
    }

    if (input.nextStatus === 'MITIGATING') {
      return {
        incidentId: input.incidentId,
        eventType: 'STATUS_CHANGED',
        visibility: 'PARTICIPANTS',
        title: 'Decisão em preparação',
        description:
          'O caso entrou na fase final de análise para definição da decisão.',
        actorUserId: input.actorUserId,
        actorName: 'Equipa de suporte',
      };
    }

    if (input.nextStatus === 'MONITORING') {
      return {
        incidentId: input.incidentId,
        eventType: 'STATUS_CHANGED',
        visibility: 'PARTICIPANTS',
        title: 'Caso em acompanhamento',
        description:
          'A equipa já atuou no caso e está a acompanhar os próximos passos.',
        actorUserId: input.actorUserId,
        actorName: 'Equipa de suporte',
      };
    }

    return {
      incidentId: input.incidentId,
      eventType: 'CASE_CLOSED',
      visibility: 'PARTICIPANTS',
      title:
        input.nextStatus === 'RESOLVED' ? 'Caso encerrado' : 'Caso cancelado',
      description:
        input.resolutionNote?.trim() ||
        (input.nextStatus === 'RESOLVED'
          ? 'A equipa encerrou o caso após concluir a análise.'
          : 'O caso foi encerrado sem ação adicional.'),
      actorUserId: input.actorUserId,
      actorName: 'Equipa de suporte',
    };
  }

  private buildParticipantDecisionTitle(refundStatus: RefundStatus) {
    if (refundStatus === 'SUCCEEDED' || refundStatus === 'PROCESSING') {
      return 'Pedido aprovado';
    }

    if (refundStatus === 'CANCELED') {
      return 'Pedido cancelado';
    }

    return 'Decisão registada';
  }

  private buildRefundDecisionFallback(refundStatus: RefundStatus) {
    if (refundStatus === 'SUCCEEDED') {
      return 'Pedido aprovado e reembolso concluído.';
    }

    if (refundStatus === 'PROCESSING') {
      return 'Pedido aprovado e reembolso em processamento.';
    }

    if (refundStatus === 'CANCELED') {
      return 'O pedido foi cancelado antes da decisão final.';
    }

    return 'A decisão foi registada, mas houve falha no processamento financeiro.';
  }

  private statusLabel(status: OperationalIncidentStatus) {
    if (status === 'INVESTIGATING') {
      return 'investigação';
    }

    if (status === 'MITIGATING') {
      return 'mitigação';
    }

    if (status === 'MONITORING') {
      return 'monitorização';
    }

    if (status === 'RESOLVED') {
      return 'resolução';
    }

    if (status === 'CANCELED') {
      return 'cancelamento';
    }

    return 'abertura';
  }

  private async createEvents(
    client: PrismaClientLike,
    events: IncidentEventCreateInput[],
  ) {
    if (events.length === 0) {
      return;
    }

    await client.operationalIncidentEvent.createMany({
      data: events,
    });
  }

  private async resolveActorName(client: PrismaClientLike, userId: string) {
    const actor = await client.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
      },
    });

    return actor?.name?.trim() || actor?.email || `user:${userId.slice(0, 8)}`;
  }

  private async assertRelatedEntitiesExist(input: {
    relatedJobId?: string;
    relatedRefundRequestId?: string;
    relatedTrustSafetyInterventionId?: string;
  }) {
    const [job, refund, intervention] = await Promise.all([
      input.relatedJobId
        ? this.prisma.job.findUnique({
            where: { id: input.relatedJobId.trim() },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.relatedRefundRequestId
        ? this.prisma.refundRequest.findUnique({
            where: { id: input.relatedRefundRequestId.trim() },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.relatedTrustSafetyInterventionId
        ? this.prisma.trustSafetyIntervention.findUnique({
            where: { id: input.relatedTrustSafetyInterventionId.trim() },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (input.relatedJobId && !job) {
      throw new NotFoundException('Related job not found');
    }

    if (input.relatedRefundRequestId && !refund) {
      throw new NotFoundException('Related refund request not found');
    }

    if (input.relatedTrustSafetyInterventionId && !intervention) {
      throw new NotFoundException('Related trust & safety case not found');
    }
  }
}
