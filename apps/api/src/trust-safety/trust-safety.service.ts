import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrustSafetyInterventionStatus } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppealTrustSafetyInterventionDto } from './dto/appeal-trust-safety-intervention.dto';
import { ListTrustSafetyInterventionsQueryDto } from './dto/list-trust-safety-interventions-query.dto';
import { ReviewTrustSafetyInterventionDto } from './dto/review-trust-safety-intervention.dto';

const interventionInclude = {
  job: {
    select: {
      id: true,
      requestId: true,
      title: true,
      status: true,
      clientId: true,
      customerId: true,
      providerId: true,
      workerProfile: {
        select: {
          userId: true,
        },
      },
    },
  },
  actorUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  counterpartUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  reviewedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.TrustSafetyInterventionInclude;

type InterventionRecord = Prisma.TrustSafetyInterventionGetPayload<{
  include: typeof interventionInclude;
}>;

type EvaluateMessageInput = {
  jobId: string;
  requestId: string | null;
  actorUserId: string;
  counterpartUserId: string;
  actorRole: 'customer' | 'provider';
  contactUnlocked: boolean;
  content: string;
};

type InterventionResponse = {
  id: string;
  jobId: string;
  actorUserId: string;
  counterpartUserId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'WARNING' | 'TEMP_BLOCK';
  status: TrustSafetyInterventionStatus;
  reasonSummary: string;
  messagePreview: string;
  blockedUntil: string | null;
  appealRequestedAt: string | null;
  appealReason: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  isBlocking: boolean;
};

@Injectable()
export class TrustSafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getConversationState(jobId: string, userId: string) {
    const items = await this.prisma.trustSafetyIntervention.findMany({
      where: {
        jobId,
        actorUserId: userId,
      },
      include: interventionInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });

    const activeIntervention =
      items.find(
        (item) =>
          ['OPEN', 'APPEALED', 'ENFORCED'].includes(item.status) &&
          item.action === 'TEMP_BLOCK',
      ) ?? null;

    return {
      activeIntervention: activeIntervention
        ? this.toInterventionDto(activeIntervention)
        : null,
      recentInterventions: items.map((item) => this.toInterventionDto(item)),
    };
  }

  async evaluateMessageAttempt(input: EvaluateMessageInput) {
    if (input.contactUnlocked) {
      return { status: 'clear' as const };
    }

    const activeRestriction =
      await this.prisma.trustSafetyIntervention.findFirst({
        where: {
          jobId: input.jobId,
          actorUserId: input.actorUserId,
          action: 'TEMP_BLOCK',
          status: {
            in: ['OPEN', 'APPEALED', 'ENFORCED'],
          },
          blockedUntil: {
            gt: new Date(),
          },
        },
        include: interventionInclude,
        orderBy: [
          { blockedUntil: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

    if (activeRestriction) {
      return {
        status: 'blocked' as const,
        intervention: this.toInterventionDto(activeRestriction),
        guidance: this.buildGuidance({
          kind: 'blocked',
          input,
          blockedUntil: activeRestriction.blockedUntil,
        }),
      };
    }

    const detection = this.detectContactSharing(input.content);
    if (!detection) {
      return { status: 'clear' as const };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const previousAttempts = await this.prisma.trustSafetyIntervention.count({
      where: {
        jobId: input.jobId,
        actorUserId: input.actorUserId,
        createdAt: {
          gte: since,
        },
      },
    });

    if (previousAttempts === 0) {
      const warning = await this.prisma.trustSafetyIntervention.create({
        data: {
          jobId: input.jobId,
          actorUserId: input.actorUserId,
          counterpartUserId: input.counterpartUserId,
          riskLevel: detection.riskLevel,
          action: 'WARNING',
          status: 'LOGGED',
          reasonSummary: detection.reasonSummary,
          messagePreview: detection.messagePreview,
          metadata: {
            signals: detection.signals,
          } satisfies Prisma.JsonObject,
        },
        include: interventionInclude,
      });

      return {
        status: 'warning' as const,
        intervention: this.toInterventionDto(warning),
        guidance: this.buildGuidance({
          kind: 'warning',
          input,
        }),
      };
    }

    const blockedUntil = new Date(
      Date.now() +
        (previousAttempts >= 2 || detection.riskLevel === 'HIGH'
          ? 4 * 60 * 60 * 1000
          : 30 * 60 * 1000),
    );

    const blocked = await this.prisma.trustSafetyIntervention.create({
      data: {
        jobId: input.jobId,
        actorUserId: input.actorUserId,
        counterpartUserId: input.counterpartUserId,
        riskLevel:
          previousAttempts >= 2 || detection.riskLevel === 'HIGH'
            ? 'HIGH'
            : 'MEDIUM',
        action: 'TEMP_BLOCK',
        status: 'OPEN',
        reasonSummary: detection.reasonSummary,
        messagePreview: detection.messagePreview,
        blockedUntil,
        metadata: {
          signals: detection.signals,
          previousAttempts,
        } satisfies Prisma.JsonObject,
      },
      include: interventionInclude,
    });

    return {
      status: 'blocked' as const,
      intervention: this.toInterventionDto(blocked),
      guidance: this.buildGuidance({
        kind: 'blocked',
        input,
        blockedUntil,
      }),
    };
  }

  async appealIntervention(
    interventionId: string,
    userId: string,
    dto: AppealTrustSafetyInterventionDto,
  ) {
    const intervention = await this.prisma.trustSafetyIntervention.findUnique({
      where: { id: interventionId },
      include: interventionInclude,
    });

    if (!intervention) {
      throw new NotFoundException('Trust & Safety intervention not found');
    }

    if (intervention.actorUserId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to appeal this intervention',
      );
    }

    if (!['OPEN', 'ENFORCED'].includes(intervention.status)) {
      throw new ConflictException('This intervention cannot be appealed');
    }

    const updated = await this.prisma.trustSafetyIntervention.update({
      where: { id: intervention.id },
      data: {
        status: 'APPEALED',
        appealRequestedAt: new Date(),
        appealReason: dto.reason.trim(),
      },
      include: interventionInclude,
    });

    return this.toInterventionDto(updated);
  }

  async adminListInterventions(query: ListTrustSafetyInterventionsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.TrustSafetyInterventionWhereInput = {
      ...(query.status
        ? { status: query.status as TrustSafetyInterventionStatus }
        : {
            status: {
              not: 'LOGGED',
            },
          }),
    };

    const [total, openCount, appealedCount, highRiskCount, items] =
      await this.prisma.$transaction([
        this.prisma.trustSafetyIntervention.count({ where }),
        this.prisma.trustSafetyIntervention.count({
          where: {
            status: 'OPEN',
          },
        }),
        this.prisma.trustSafetyIntervention.count({
          where: {
            status: 'APPEALED',
          },
        }),
        this.prisma.trustSafetyIntervention.count({
          where: {
            riskLevel: 'HIGH',
            status: {
              in: ['OPEN', 'APPEALED', 'ENFORCED'],
            },
          },
        }),
        this.prisma.trustSafetyIntervention.findMany({
          where,
          include: interventionInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
        }),
      ]);

    return {
      ...buildPaginatedResponse({
        data: items.map((item) => this.toAdminDto(item)),
        total,
        page,
        limit,
      }),
      summary: {
        openCount,
        appealedCount,
        highRiskCount,
      },
    };
  }

  async reviewIntervention(
    interventionId: string,
    reviewerUserId: string,
    dto: ReviewTrustSafetyInterventionDto,
  ) {
    const intervention = await this.prisma.trustSafetyIntervention.findUnique({
      where: { id: interventionId },
      include: interventionInclude,
    });

    if (!intervention) {
      throw new NotFoundException('Trust & Safety intervention not found');
    }

    if (!['OPEN', 'APPEALED', 'ENFORCED'].includes(intervention.status)) {
      throw new ConflictException('This intervention is no longer reviewable');
    }

    const updated = await this.prisma.trustSafetyIntervention.update({
      where: { id: intervention.id },
      data: {
        status: dto.decision,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        resolutionNote: dto.resolutionNote?.trim() || null,
        blockedUntil:
          dto.decision === 'CLEARED'
            ? new Date()
            : intervention.blockedUntil &&
                intervention.blockedUntil > new Date()
              ? intervention.blockedUntil
              : new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      include: interventionInclude,
    });

    await this.notificationsService.create({
      userId: updated.actorUserId,
      actorUserId: reviewerUserId,
      kind: 'TRUST_SAFETY_UPDATE',
      tone: dto.decision === 'CLEARED' ? 'SUCCESS' : 'ATTENTION',
      title:
        dto.decision === 'CLEARED'
          ? 'Restrição de mensagens revista'
          : 'Restrição de mensagens confirmada',
      description:
        dto.decision === 'CLEARED'
          ? dto.resolutionNote?.trim() ||
            'A equipa revogou a restrição e podes voltar a usar o chat normalmente.'
          : dto.resolutionNote?.trim() ||
            'A equipa confirmou a intervenção por tentativa de partilha de contacto fora do fluxo protegido.',
      href: this.buildConversationHref(updated),
      hrefLabel: 'Abrir conversa',
      metadata: {
        jobId: updated.jobId,
        interventionId: updated.id,
        status: updated.status,
      } satisfies Prisma.JsonObject,
    });

    return this.toAdminDto(updated);
  }

  private detectContactSharing(content: string) {
    const trimmed = content.trim();
    const normalized = trimmed.toLowerCase();
    const signals: string[] = [];

    const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    const urlRegex = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|bit\.ly\/)/i;
    const phoneRegex = /(?:\+?\d[\d\s().-]{6,}\d)/g;
    const keywordRegex =
      /\b(whatsapp|whats|telegram|telemovel|telefone|numero|n[uú]mero|email|gmail|hotmail|liga|liga-me|contacta|contacto|call|dm|instagram|facebook|inbox)\b/i;

    if (emailRegex.test(trimmed)) {
      signals.push('email');
    }

    if (urlRegex.test(trimmed)) {
      signals.push('external_link');
    }

    const phoneMatches = trimmed.match(phoneRegex) ?? [];
    const hasPhoneLike = phoneMatches.some((match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 8;
    });
    if (hasPhoneLike) {
      signals.push('phone');
    }

    if (keywordRegex.test(normalized)) {
      signals.push('external_contact_keyword');
    }

    if (signals.length === 0) {
      return null;
    }

    const riskLevel =
      signals.includes('phone') ||
      signals.includes('email') ||
      signals.includes('external_link')
        ? 'HIGH'
        : 'LOW';

    const summary =
      riskLevel === 'HIGH'
        ? 'Tentativa de partilha direta de contacto antes do pagamento.'
        : 'Mensagem sugere desvio para contacto externo antes do pagamento.';

    return {
      riskLevel,
      signals,
      reasonSummary: summary,
      messagePreview:
        trimmed.length > 180
          ? `${trimmed.slice(0, 177).trimEnd()}...`
          : trimmed,
    } as const;
  }

  private buildGuidance(input: {
    kind: 'warning' | 'blocked';
    input: EvaluateMessageInput;
    blockedUntil?: Date | null;
  }) {
    const isCustomer = input.input.actorRole === 'customer';
    const ctaHref = isCustomer
      ? input.input.requestId
        ? `/app/pedidos/${input.input.requestId}`
        : '/app/pagamentos'
      : '/pro/mensagens';

    return {
      title:
        input.kind === 'warning'
          ? 'Partilha de contacto ainda nao esta protegida'
          : 'Mensagens temporariamente restringidas',
      description:
        input.kind === 'warning'
          ? 'Antes do sinal ser confirmado, o Tchuno protege o contacto e a cobertura de suporte. Edita a mensagem ou avanca pelo fluxo protegido.'
          : `Detetámos repetidas tentativas de partilha de contacto antes do pagamento. O chat fica temporariamente restringido${input.blockedUntil ? ` ate ${input.blockedUntil.toLocaleString('pt-PT')}` : ''}.`,
      ctaHref,
      ctaLabel: isCustomer
        ? 'Ver pedido e pagar sinal'
        : 'Continuar no chat protegido',
      appealAllowed: input.kind === 'blocked',
    };
  }

  private buildConversationHref(item: {
    jobId: string;
    job: {
      requestId: string | null;
      clientId: string;
      customerId: string | null;
      providerId: string | null;
      workerProfile: { userId: string };
    };
    actorUserId: string;
  }) {
    const isCustomer =
      item.actorUserId === item.job.clientId ||
      item.actorUserId === item.job.customerId;

    if (isCustomer && item.job.requestId) {
      return `/app/pedidos/${item.job.requestId}`;
    }

    return isCustomer
      ? `/app/mensagens?job=${item.jobId}`
      : `/pro/mensagens?job=${item.jobId}`;
  }

  private toInterventionDto(item: InterventionRecord): InterventionResponse {
    return {
      id: item.id,
      jobId: item.jobId,
      actorUserId: item.actorUserId,
      counterpartUserId: item.counterpartUserId,
      riskLevel: item.riskLevel,
      action: item.action,
      status: item.status,
      reasonSummary: item.reasonSummary,
      messagePreview: item.messagePreview,
      blockedUntil: item.blockedUntil ? item.blockedUntil.toISOString() : null,
      appealRequestedAt: item.appealRequestedAt
        ? item.appealRequestedAt.toISOString()
        : null,
      appealReason: item.appealReason,
      reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
      resolutionNote: item.resolutionNote,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      isBlocking:
        item.action === 'TEMP_BLOCK' &&
        ['OPEN', 'APPEALED', 'ENFORCED'].includes(item.status) &&
        Boolean(item.blockedUntil && item.blockedUntil.getTime() > Date.now()),
    };
  }

  private toAdminDto(item: InterventionRecord) {
    return {
      ...this.toInterventionDto(item),
      job: {
        id: item.job.id,
        requestId: item.job.requestId,
        title: item.job.title,
        status: item.job.status,
      },
      actorUser: item.actorUser,
      counterpartUser: item.counterpartUser,
      reviewedByUser: item.reviewedByUser,
    };
  }
}
