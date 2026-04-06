import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  PaymentProvider,
  Prisma,
  RequestInvitationStatus,
  ServiceRequestStatus,
} from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { AppRole } from '../auth/authorization.types';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestInvitationDto } from './dto/create-request-invitation.dto';
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

const defaultServiceRequestExpiryHours = 72;
const defaultServiceRequestExpirySweepMs = 60_000;

const invitationProviderUserSelect = {
  id: true,
  name: true,
  workerProfile: {
    select: {
      ratingAvg: true,
      ratingCount: true,
      location: true,
    },
  },
} satisfies Prisma.UserSelect;

const requestInvitationInclude = {
  providerUser: {
    select: invitationProviderUserSelect,
  },
} satisfies Prisma.RequestInvitationInclude;

const customerRequestDetailInclude = {
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
  invitations: {
    include: requestInvitationInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
      review: {
        select: {
          id: true,
          jobId: true,
          workerProfileId: true,
          reviewerId: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceRequestInclude;

type ExpirableRequestSnapshot = {
  id: string;
  status: ServiceRequestStatus;
  expiresAt: Date;
  selectedProposalId: string | null;
};

@Injectable()
export class ServiceRequestsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceRequestsService.name);
  private expirySweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  onModuleInit() {
    void this.expireStaleOpenRequests();

    const sweepIntervalMs = this.resolveRequestExpirySweepIntervalMs();
    if (sweepIntervalMs <= 0) {
      return;
    }

    this.expirySweepTimer = setInterval(() => {
      void this.expireStaleOpenRequests().catch((error) => {
        this.logger.error(
          'Failed to expire stale service requests',
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, sweepIntervalMs);

    this.expirySweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (!this.expirySweepTimer) {
      return;
    }

    clearInterval(this.expirySweepTimer);
    this.expirySweepTimer = null;
  }

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
        expiresAt: this.buildRequestExpiryDate(),
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event: 'service_request_created',
      result: 'success',
    });

    return created;
  }

  async recreate(actorUserId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        customerId: true,
        categoryId: true,
        title: true,
        description: true,
        location: true,
        status: true,
        selectedProposalId: true,
        expiresAt: true,
        job: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actorUserId) {
      throw new ForbiddenException(
        'Only request owner can recreate this request',
      );
    }

    const currentStatus = await this.refreshRequestStatusIfExpired(request);
    if (
      currentStatus !== 'EXPIRED' ||
      request.selectedProposalId ||
      request.job
    ) {
      throw new ConflictException(
        'Only expired requests without selected proposal can be recreated',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: request.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    const recreated = await this.prisma.serviceRequest.create({
      data: {
        customerId: actorUserId,
        categoryId: request.categoryId,
        title: request.title,
        description: request.description,
        location: request.location,
        status: 'OPEN',
        expiresAt: this.buildRequestExpiryDate(),
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event: 'service_request_recreated',
      result: 'success',
    });

    return recreated;
  }

  async listMine(actorUserId: string, query: ListServiceRequestsQueryDto) {
    await this.expireStaleOpenRequests();

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
              review: {
                select: {
                  id: true,
                  jobId: true,
                  workerProfileId: true,
                  reviewerId: true,
                  rating: true,
                  comment: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
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
    await this.expireStaleOpenRequests();

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
      include: customerRequestDetailInclude,
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actorUserId) {
      throw new ForbiddenException('Only request owner can read this request');
    }

    const currentStatus = await this.refreshRequestStatusIfExpired(request);
    if (currentStatus === 'EXPIRED') {
      return this.prisma.serviceRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: customerRequestDetailInclude,
      });
    }

    return request;
  }

  async listRequestInvitations(requestId: string, actorUserId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        customerId: true,
        status: true,
        selectedProposalId: true,
        expiresAt: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actorUserId) {
      throw new ForbiddenException('Only request owner can read invitations');
    }

    const currentStatus = await this.refreshRequestStatusIfExpired(request);
    await this.expirePendingInvitationsForRequest(request.id, currentStatus);

    return this.prisma.requestInvitation.findMany({
      where: {
        requestId,
      },
      include: requestInvitationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createInvitation(
    requestId: string,
    actorUserId: string,
    dto: CreateRequestInvitationDto,
  ) {
    if (dto.providerUserId === actorUserId) {
      throw new ConflictException(
        'You cannot invite yourself to your own service request',
      );
    }

    const [request, providerProfile, existingProposal, existingInvitation] =
      await this.prisma.$transaction([
        this.prisma.serviceRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            customerId: true,
            status: true,
            selectedProposalId: true,
            expiresAt: true,
          },
        }),
        this.prisma.workerProfile.findUnique({
          where: { userId: dto.providerUserId },
          select: {
            id: true,
            isAvailable: true,
          },
        }),
        this.prisma.proposal.findUnique({
          where: {
            requestId_providerId: {
              requestId,
              providerId: dto.providerUserId,
            },
          },
          select: {
            id: true,
          },
        }),
        this.prisma.requestInvitation.findUnique({
          where: {
            requestId_providerUserId: {
              requestId,
              providerUserId: dto.providerUserId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        }),
      ]);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== actorUserId) {
      throw new ForbiddenException(
        'Only request owner can invite providers to this request',
      );
    }

    const currentStatus = await this.refreshRequestStatusIfExpired(request);

    if (currentStatus !== 'OPEN' || request.selectedProposalId) {
      throw new ConflictException(
        'Service request is no longer open for invitations',
      );
    }

    if (!providerProfile) {
      throw new NotFoundException('Worker profile not found');
    }

    if (!providerProfile.isAvailable) {
      throw new ConflictException(
        'Only available providers can be invited to send proposals',
      );
    }

    if (existingProposal) {
      throw new ConflictException(
        'This provider already submitted a proposal for the request',
      );
    }

    if (existingInvitation) {
      throw new ConflictException(
        this.describeDuplicateInvitationStatus(existingInvitation.status),
      );
    }

    const invitation = await this.prisma.requestInvitation.create({
      data: {
        requestId,
        providerUserId: dto.providerUserId,
        status: 'SENT',
      },
      include: requestInvitationInclude,
    });

    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event: 'service_request_invitation_created',
      result: 'success',
    });

    return invitation;
  }

  async listMineInvitations(actorUserId: string) {
    await this.expireStaleOpenRequests();
    await this.expirePendingInvitationsForProvider(actorUserId);

    return this.prisma.requestInvitation.findMany({
      where: {
        providerUserId: actorUserId,
      },
      include: {
        request: {
          select: {
            id: true,
            customerId: true,
            categoryId: true,
            title: true,
            description: true,
            location: true,
            status: true,
            selectedProposalId: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
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
                providerId: true,
                price: true,
                status: true,
                comment: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listMineProposals(actorUserId: string) {
    await this.expireStaleOpenRequests();

    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Worker profile not found');
    }

    const proposals = await this.prisma.proposal.findMany({
      where: {
        providerId: actorUserId,
      },
      include: {
        request: {
          select: {
            id: true,
            customerId: true,
            categoryId: true,
            title: true,
            description: true,
            location: true,
            status: true,
            selectedProposalId: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            invitations: {
              where: {
                providerUserId: actorUserId,
              },
              select: {
                id: true,
                requestId: true,
                providerUserId: true,
                status: true,
                respondedAt: true,
                expiresAt: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return proposals.map((proposal) => ({
      ...proposal,
      request: {
        ...proposal.request,
        invitation: proposal.request.invitations[0] ?? null,
      },
    }));
  }

  async declineInvitation(invitationId: string, actorUserId: string) {
    const invitation = await this.prisma.requestInvitation.findUnique({
      where: { id: invitationId },
      include: {
        request: {
          select: {
            id: true,
            status: true,
            selectedProposalId: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Request invitation not found');
    }

    if (invitation.providerUserId !== actorUserId) {
      throw new ForbiddenException('Only invited provider can decline invite');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ConflictException(
        'Invitation already accepted through submitted proposal',
      );
    }

    if (invitation.status === 'DECLINED') {
      return invitation;
    }

    const currentRequestStatus = await this.refreshRequestStatusIfExpired(
      invitation.request,
    );

    if (
      invitation.status === 'EXPIRED' ||
      currentRequestStatus !== 'OPEN' ||
      invitation.request.selectedProposalId
    ) {
      if (invitation.status === 'EXPIRED') {
        return invitation;
      }

      return this.prisma.requestInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'EXPIRED',
          respondedAt: invitation.respondedAt ?? new Date(),
          expiresAt: invitation.expiresAt ?? new Date(),
        },
      });
    }

    const declinedInvitation = await this.prisma.requestInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event: 'service_request_invitation_declined',
      result: 'success',
    });

    return declinedInvitation;
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
          expiresAt: true,
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

    const currentStatus = await this.refreshRequestStatusIfExpired(request);

    if (currentStatus !== 'OPEN' || request.selectedProposalId) {
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

    const proposal = existing
      ? await this.prisma.proposal.update({
          where: { id: existing.id },
          data: {
            price,
            comment: dto.comment?.trim() || null,
            status: 'SUBMITTED',
          },
        })
      : await this.prisma.proposal.create({
          data: {
            requestId,
            providerId: actorUserId,
            price,
            comment: dto.comment?.trim() || null,
            status: 'SUBMITTED',
          },
        });

    await this.markInvitationAccepted(requestId, actorUserId);

    return proposal;
  }

  async listRequestProposals(requestId: string, actor: Actor) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        customerId: true,
        status: true,
        selectedProposalId: true,
        expiresAt: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    await this.refreshRequestStatusIfExpired(request);

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
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
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

    const currentStatus = await this.refreshRequestStatusIfExpired(request);

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

    if (currentStatus !== 'OPEN') {
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
        await tx.requestInvitation.updateMany({
          where: {
            requestId: request.id,
            status: 'SENT',
          },
          data: {
            status: 'EXPIRED',
            respondedAt: new Date(),
            expiresAt: new Date(),
          },
        });

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

      await tx.requestInvitation.updateMany({
        where: {
          requestId: request.id,
          status: 'SENT',
        },
        data: {
          status: 'EXPIRED',
          respondedAt: new Date(),
          expiresAt: new Date(),
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

  private async expireStaleOpenRequests() {
    const staleRequests = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'OPEN',
        selectedProposalId: null,
        expiresAt: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
      },
    });

    if (staleRequests.length === 0) {
      return 0;
    }

    await this.expireRequestsByIds(staleRequests.map((request) => request.id));
    return staleRequests.length;
  }

  private async expirePendingInvitationsForRequest(
    requestId: string,
    requestStatus?: ServiceRequestStatus,
  ) {
    if (requestStatus === 'OPEN') {
      return;
    }

    const staleInvitations = await this.prisma.requestInvitation.findMany({
      where: {
        requestId,
        status: 'SENT',
      },
      select: {
        id: true,
      },
    });

    if (staleInvitations.length === 0) {
      return;
    }

    await this.prisma.requestInvitation.updateMany({
      where: {
        id: {
          in: staleInvitations.map((invitation) => invitation.id),
        },
      },
      data: {
        status: 'EXPIRED',
        respondedAt: new Date(),
        expiresAt: new Date(),
      },
    });
  }

  private async expireRequestsByIds(requestIds: string[]) {
    if (requestIds.length === 0) {
      return;
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.serviceRequest.updateMany({
        where: {
          id: {
            in: requestIds,
          },
          status: 'OPEN',
        },
        data: {
          status: 'EXPIRED',
        },
      }),
      this.prisma.requestInvitation.updateMany({
        where: {
          requestId: {
            in: requestIds,
          },
          status: 'SENT',
        },
        data: {
          status: 'EXPIRED',
          respondedAt: now,
          expiresAt: now,
        },
      }),
    ]);

    requestIds.forEach(() => {
      this.metricsService.recordBusinessEvent({
        domain: 'jobs',
        event: 'service_request_expired',
        result: 'success',
      });
    });
  }

  private async refreshRequestStatusIfExpired(
    request: ExpirableRequestSnapshot,
  ): Promise<ServiceRequestStatus> {
    if (!this.isRequestPastExpiry(request)) {
      return request.status;
    }

    await this.expireRequestsByIds([request.id]);
    return 'EXPIRED';
  }

  private isRequestPastExpiry(request: ExpirableRequestSnapshot) {
    return (
      request.status === 'OPEN' &&
      !request.selectedProposalId &&
      request.expiresAt.getTime() <= Date.now()
    );
  }

  private async expirePendingInvitationsForProvider(actorUserId: string) {
    const staleInvitations = await this.prisma.requestInvitation.findMany({
      where: {
        providerUserId: actorUserId,
        status: 'SENT',
        request: {
          status: {
            not: 'OPEN',
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (staleInvitations.length === 0) {
      return;
    }

    await this.prisma.requestInvitation.updateMany({
      where: {
        id: {
          in: staleInvitations.map((invitation) => invitation.id),
        },
      },
      data: {
        status: 'EXPIRED',
        respondedAt: new Date(),
        expiresAt: new Date(),
      },
    });
  }

  private async markInvitationAccepted(
    requestId: string,
    providerUserId: string,
  ) {
    const result = await this.prisma.requestInvitation.updateMany({
      where: {
        requestId,
        providerUserId,
        status: {
          in: ['SENT', 'DECLINED', 'EXPIRED'],
        },
      },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        expiresAt: null,
      },
    });

    if (result.count > 0) {
      this.metricsService.recordBusinessEvent({
        domain: 'jobs',
        event: 'service_request_invitation_accepted',
        result: 'success',
      });
    }
  }

  private describeDuplicateInvitationStatus(status: RequestInvitationStatus) {
    if (status === 'ACCEPTED') {
      return 'This provider already accepted the invitation through a proposal';
    }

    if (status === 'DECLINED') {
      return 'This provider already declined the invitation';
    }

    if (status === 'EXPIRED') {
      return 'This invitation already expired for the provider';
    }

    return 'This provider was already invited to the request';
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

  private buildRequestExpiryDate(baseDate = new Date()) {
    return new Date(
      baseDate.getTime() +
        this.resolveRequestExpiryHoursFromEnv() * 60 * 60 * 1000,
    );
  }

  private resolveRequestExpiryHoursFromEnv() {
    const parsed = Number(process.env.SERVICE_REQUEST_EXPIRY_HOURS);
    if (!Number.isFinite(parsed)) {
      return defaultServiceRequestExpiryHours;
    }

    return Math.min(168, Math.max(1, Math.trunc(parsed)));
  }

  private resolveRequestExpirySweepIntervalMs() {
    const parsed = Number(process.env.SERVICE_REQUEST_EXPIRY_SWEEP_MS);
    if (!Number.isFinite(parsed)) {
      return defaultServiceRequestExpirySweepMs;
    }

    return Math.max(5_000, Math.trunc(parsed));
  }
}
