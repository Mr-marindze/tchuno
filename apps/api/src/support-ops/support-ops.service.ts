import { Injectable, NotFoundException } from '@nestjs/common';
import { OperationalIncidentStatus, Prisma } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationalIncidentDto } from './dto/create-operational-incident.dto';
import { ListOperationalIncidentsQueryDto } from './dto/list-operational-incidents-query.dto';
import { UpdateOperationalIncidentDto } from './dto/update-operational-incident.dto';

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
} satisfies Prisma.OperationalIncidentInclude;

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

    const [total, data, unresolvedCount, criticalCount, resolvedCount] =
      await this.prisma.$transaction([
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
      },
    };
  }

  async createIncident(actorUserId: string, dto: CreateOperationalIncidentDto) {
    await this.assertRelatedEntitiesExist(dto);

    return this.prisma.operationalIncident.create({
      data: {
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        source: dto.source ?? 'SUPPORT',
        severity: dto.severity ?? 'MEDIUM',
        impactedArea: dto.impactedArea?.trim() || null,
        customerImpact: dto.customerImpact?.trim() || null,
        evidenceItems: normalizeEvidenceItems(dto.evidenceItems),
        createdByUserId: actorUserId,
        ownerAdminUserId: actorUserId,
        relatedJobId: dto.relatedJobId?.trim() || null,
        relatedRefundRequestId: dto.relatedRefundRequestId?.trim() || null,
        relatedTrustSafetyInterventionId:
          dto.relatedTrustSafetyInterventionId?.trim() || null,
      },
      include: incidentInclude,
    });
  }

  async updateIncident(
    incidentId: string,
    actorUserId: string,
    dto: UpdateOperationalIncidentDto,
  ) {
    const existing = await this.prisma.operationalIncident.findUnique({
      where: { id: incidentId },
    });

    if (!existing) {
      throw new NotFoundException('Operational incident not found');
    }

    const nextStatus = dto.status ?? existing.status;
    const isResolvedStatus =
      nextStatus === OperationalIncidentStatus.RESOLVED ||
      nextStatus === OperationalIncidentStatus.CANCELED;

    const updated = await this.prisma.operationalIncident.update({
      where: { id: incidentId },
      data: {
        title: dto.title?.trim(),
        summary: dto.summary?.trim(),
        source: dto.source,
        severity: dto.severity,
        status: nextStatus,
        impactedArea:
          dto.impactedArea !== undefined
            ? dto.impactedArea.trim() || null
            : undefined,
        customerImpact:
          dto.customerImpact !== undefined
            ? dto.customerImpact.trim() || null
            : undefined,
        evidenceItems:
          dto.evidenceItems !== undefined
            ? normalizeEvidenceItems(dto.evidenceItems)
            : undefined,
        resolutionNote:
          dto.resolutionNote !== undefined
            ? dto.resolutionNote.trim() || null
            : undefined,
        resolvedAt: isResolvedStatus
          ? (existing.resolvedAt ?? new Date())
          : null,
        ownerAdminUserId: existing.ownerAdminUserId ?? actorUserId,
      },
      include: incidentInclude,
    });

    return updated;
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
