import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentProvider, Prisma, ServiceRequestStatus } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { AppRole } from '../auth/authorization.types';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ListServiceRequestsQueryDto } from './dto/list-service-requests-query.dto';
import { SelectProposalDto } from './dto/select-proposal.dto';
import { SubmitProposalDto } from './dto/submit-proposal.dto';

type Actor = {
  userId: string;
  role?: AppRole;
};

const adminRoles = new Set<AppRole>([
  'admin',
  'support_admin',
  'ops_admin',
  'super_admin',
]);

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async create(actorUserId: string, dto: CreateServiceRequestDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const created = await this.prisma.serviceRequest.create({
      data: {
        customerId: actorUserId,
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        location: dto.location?.trim() || null,
        status: 'OPEN',
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event: 'service_request_created',
      result: 'success',
    });

    return created;
  }

  async listMine(actorUserId: string, query: ListServiceRequestsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.ServiceRequestWhereInput = {
      customerId: actorUserId,
      ...(query.status
        ? {
            status: query.status as ServiceRequestStatus,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          proposals: {
            select: {
              id: true,
              providerId: true,
              price: true,
              status: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
          job: {
            select: {
              id: true,
              status: true,
              contactUnlockedAt: true,
              agreedPrice: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async listOpenForProvider(
    actorUserId: string,
    query: ListServiceRequestsQueryDto,
  ) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true, isAvailable: true },
    });

    if (!profile) {
      throw new NotFoundException('Worker profile not found');
    }

    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.ServiceRequestWhereInput = {
      status: query.status ? (query.status as ServiceRequestStatus) : 'OPEN',
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.serviceRequest.count({ where }),
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          proposals: {
            where: {
              providerId: actorUserId,
            },
            select: {
              id: true,
              status: true,
              price: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async getMineById(actorUserId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        proposals: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                workerProfile: {
                  select: {
                    ratingAvg: true,
                    ratingCount: true,
                    location: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        job: {
          select: {
            id: true,
            status: true,
            requestId: true,
            proposalId: true,
            agreedPrice: true,
            contactUnlockedAt: true,
            createdAt: true,
            paymentIntents: {
              select: {
                id: true,
                amount: true,
                status: true,
                provider: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actorUserId) {
      throw new ForbiddenException('Only request owner can read this request');
    }

    return request;
  }

  async submitProposal(
    requestId: string,
    actorUserId: string,
    dto: SubmitProposalDto,
  ) {
    const [request, profile] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          customerId: true,
          status: true,
          selectedProposalId: true,
        },
      }),
      this.prisma.workerProfile.findUnique({
        where: { userId: actorUserId },
        select: {
          id: true,
          isAvailable: true,
        },
      }),
    ]);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (!profile) {
      throw new NotFoundException('Worker profile not found');
    }

    if (!profile.isAvailable) {
      throw new ConflictException(
        'Only available providers can send proposals',
      );
    }

    if (request.customerId === actorUserId) {
      throw new ConflictException(
        'You cannot propose to your own service request',
      );
    }

    if (request.status !== 'OPEN' || request.selectedProposalId) {
      throw new ConflictException(
        'Service request is no longer open for proposals',
      );
    }

    const price = Math.trunc(dto.price);
    if (price <= 0) {
      throw new BadRequestException('price must be greater than zero');
    }

    const existing = await this.prisma.proposal.findUnique({
      where: {
        requestId_providerId: {
          requestId,
          providerId: actorUserId,
        },
      },
    });

    if (existing) {
      return this.prisma.proposal.update({
        where: { id: existing.id },
        data: {
          price,
          comment: dto.comment?.trim() || null,
          status: 'SUBMITTED',
        },
      });
    }

    return this.prisma.proposal.create({
      data: {
        requestId,
        providerId: actorUserId,
        price,
        comment: dto.comment?.trim() || null,
        status: 'SUBMITTED',
      },
    });
  }

  async listRequestProposals(requestId: string, actor: Actor) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        customerId: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    const isAdmin = adminRoles.has(actor.role ?? 'customer');
    const isCustomerOwner = request.customerId === actor.userId;

    if (!isAdmin && !isCustomerOwner) {
      const hasOwnProposal = await this.prisma.proposal.findFirst({
        where: {
          requestId,
          providerId: actor.userId,
        },
        select: { id: true },
      });

      if (!hasOwnProposal) {
        throw new ForbiddenException('Not allowed to view these proposals');
      }
    }

    return this.prisma.proposal.findMany({
      where: {
        requestId,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            workerProfile: {
              select: {
                ratingAvg: true,
                ratingCount: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async selectProposal(
    requestId: string,
    proposalId: string,
    actorUserId: string,
    dto?: SelectProposalDto,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        job: {
          include: {
            paymentIntents: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actorUserId) {
      throw new ForbiddenException('Only request owner can select a proposal');
    }

    if (
      request.selectedProposalId &&
      request.selectedProposalId !== proposalId
    ) {
      throw new ConflictException(
        'A proposal was already selected for this request',
      );
    }

    if (request.selectedProposalId === proposalId && request.job) {
      return {
        request,
        selectedProposalId: proposalId,
        job: request.job,
        paymentIntent: request.job.paymentIntents[0] ?? null,
        idempotent: true,
      };
    }

    if (request.status !== 'OPEN') {
      throw new ConflictException('Service request is not open anymore');
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        requestId: true,
        providerId: true,
        price: true,
        status: true,
        comment: true,
      },
    });

    if (!proposal || proposal.requestId !== requestId) {
      throw new NotFoundException('Proposal not found for this request');
    }

    if (!['SUBMITTED', 'SELECTED'].includes(proposal.status)) {
      throw new ConflictException(
        'Proposal cannot be selected in current status',
      );
    }

    const providerProfile = await this.prisma.workerProfile.findUnique({
      where: { userId: proposal.providerId },
      select: {
        id: true,
        isAvailable: true,
      },
    });

    if (!providerProfile) {
      throw new ConflictException('Selected provider profile does not exist');
    }

    if (!providerProfile.isAvailable) {
      throw new ConflictException('Selected provider is currently unavailable');
    }

    const split = this.computeDepositSplit(proposal.price, dto?.depositPercent);

    const result = await this.prisma.$transaction(async (tx) => {
      const existingJob = await tx.job.findUnique({
        where: { requestId: request.id },
        include: {
          paymentIntents: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
      });

      if (existingJob) {
        return {
          request,
          selectedProposalId: proposal.id,
          job: existingJob,
          paymentIntent: existingJob.paymentIntents[0] ?? null,
          idempotent: true,
        };
      }

      await tx.proposal.updateMany({
        where: {
          requestId: request.id,
          id: {
            not: proposal.id,
          },
        },
        data: {
          status: 'REJECTED',
        },
      });

      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: 'SELECTED',
        },
      });

      const updatedRequest = await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: 'CLOSED',
          selectedProposalId: proposal.id,
        },
      });

      const job = await tx.job.create({
        data: {
          requestId: request.id,
          proposalId: proposal.id,
          clientId: actorUserId,
          customerId: actorUserId,
          providerId: proposal.providerId,
          workerProfileId: providerProfile.id,
          categoryId: request.categoryId,
          agreedPrice: proposal.price,
          pricingMode: 'FIXED_PRICE',
          title: request.title,
          description: request.description,
          budget: proposal.price,
          quotedAmount: proposal.price,
          quoteMessage: proposal.comment,
          status: 'REQUESTED',
        },
      });

      const intent = await tx.paymentIntent.create({
        data: {
          jobId: job.id,
          customerId: actorUserId,
          providerUserId: proposal.providerId,
          amount: split.depositAmount,
          currency: 'MZN',
          platformFeeAmount: split.platformFeeAmount,
          providerNetAmount: split.providerNetAmount,
          status: 'AWAITING_PAYMENT',
          provider: this.resolveDefaultPaymentProvider(),
          acceptedQuoteSnapshot: proposal.price,
          metadata: {
            kind: 'deposit',
            agreedPrice: proposal.price,
            depositPercent: split.depositPercent,
            serviceRequestId: request.id,
            proposalId: proposal.id,
          } satisfies Prisma.JsonObject,
        },
      });

      return {
        request: updatedRequest,
        selectedProposalId: proposal.id,
        job,
        paymentIntent: intent,
        idempotent: false,
      };
    });

    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event: 'service_request_proposal_selected',
      result: 'success',
    });

    return result;
  }

  private computeDepositSplit(price: number, depositPercent?: number) {
    const normalizedPrice = Math.max(0, Math.trunc(price));
    if (normalizedPrice <= 0) {
      throw new BadRequestException('Proposal price must be greater than 0');
    }

    const resolvedDepositPercent =
      depositPercent ?? this.resolveDepositPercentFromEnv();

    const depositAmount = Math.max(
      1,
      Math.round((normalizedPrice * resolvedDepositPercent) / 100),
    );

    const platformFeeBps = this.resolvePlatformFeeBpsFromEnv();
    const platformFeeAmount = Math.min(
      depositAmount,
      Math.round((depositAmount * platformFeeBps) / 10_000),
    );

    const providerNetAmount = Math.max(0, depositAmount - platformFeeAmount);

    return {
      depositPercent: resolvedDepositPercent,
      depositAmount,
      platformFeeAmount,
      providerNetAmount,
    };
  }

  private resolveDepositPercentFromEnv() {
    const parsed = Number(process.env.PAYMENT_DEPOSIT_PERCENT);
    if (!Number.isFinite(parsed)) {
      return 30;
    }

    return Math.min(30, Math.max(20, Math.trunc(parsed)));
  }

  private resolvePlatformFeeBpsFromEnv() {
    const parsed = Number(process.env.PAYMENT_PLATFORM_FEE_BPS);
    if (!Number.isFinite(parsed)) {
      return 1500;
    }

    return Math.min(9000, Math.max(0, Math.trunc(parsed)));
  }

  private resolveDefaultPaymentProvider(): PaymentProvider {
    const raw = process.env.PAYMENT_DEFAULT_PROVIDER?.trim().toUpperCase();
    if (!raw) {
      return PaymentProvider.INTERNAL;
    }

    if (raw in PaymentProvider) {
      return raw as PaymentProvider;
    }

    return PaymentProvider.INTERNAL;
  }
}
