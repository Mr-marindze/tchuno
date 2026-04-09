import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrustSafetyService } from '../trust-safety/trust-safety.service';
import { CreateJobMessageDto } from './dto/create-job-message.dto';

const messageJobInclude = {
  client: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  customer: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  provider: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  workerProfile: {
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  },
  paymentIntents: {
    where: {
      status: {
        in: ['PAID_PARTIAL', 'SUCCEEDED'],
      },
    },
    select: {
      id: true,
    },
    take: 1,
  },
} satisfies Prisma.JobInclude;

type MessageJob = Prisma.JobGetPayload<{
  include: typeof messageJobInclude;
}>;

type Participant = Pick<User, 'id' | 'email' | 'name'>;

type AccessibleConversation = {
  job: MessageJob;
  role: 'customer' | 'provider';
  customer: Participant;
  provider: Participant;
  counterpart: Participant;
  contactUnlocked: boolean;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly trustSafetyService: TrustSafetyService,
  ) {}

  async listMine(userId: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [
          { clientId: userId },
          { customerId: userId },
          { providerId: userId },
          {
            workerProfile: {
              is: {
                userId,
              },
            },
          },
        ],
      },
      include: messageJobInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    if (jobs.length === 0) {
      return [];
    }

    const jobIds = jobs.map((job) => job.id);
    const messages = await this.prisma.jobMessage.findMany({
      where: {
        jobId: {
          in: jobIds,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const latestMessageByJobId = new Map<string, (typeof messages)[number]>();
    const unreadCountByJobId = new Map<string, number>();

    for (const message of messages) {
      if (!latestMessageByJobId.has(message.jobId)) {
        latestMessageByJobId.set(message.jobId, message);
      }

      if (message.recipientUserId === userId && !message.readAt) {
        unreadCountByJobId.set(
          message.jobId,
          (unreadCountByJobId.get(message.jobId) ?? 0) + 1,
        );
      }
    }

    return jobs
      .map((job) => {
        const access = this.resolveConversationAccess(job, userId);
        const latestMessage = latestMessageByJobId.get(job.id) ?? null;

        return {
          jobId: job.id,
          requestId: job.requestId,
          title: job.title,
          status: job.status,
          contactUnlocked: access.contactUnlocked,
          counterpart: this.toParticipantDto(
            access.counterpart,
            access.contactUnlocked,
          ),
          unreadCount: unreadCountByJobId.get(job.id) ?? 0,
          latestMessage: latestMessage
            ? this.toMessageDto(latestMessage)
            : null,
          lastActivityAt: (
            latestMessage?.createdAt ??
            job.updatedAt ??
            job.createdAt
          ).toISOString(),
          createdAt: job.createdAt.toISOString(),
        };
      })
      .sort(
        (left, right) =>
          new Date(right.lastActivityAt).getTime() -
          new Date(left.lastActivityAt).getTime(),
      );
  }

  async listByJob(jobId: string, userId: string) {
    const access = await this.getConversationOrThrow(jobId, userId);
    const messages = await this.prisma.jobMessage.findMany({
      where: { jobId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const trustSafety = await this.trustSafetyService.getConversationState(
      jobId,
      userId,
    );

    return {
      conversation: {
        jobId: access.job.id,
        requestId: access.job.requestId,
        title: access.job.title,
        status: access.job.status,
        contactUnlocked: access.contactUnlocked,
        counterpart: this.toParticipantDto(
          access.counterpart,
          access.contactUnlocked,
        ),
        createdAt: access.job.createdAt.toISOString(),
      },
      trustSafety,
      items: messages.map((message) => this.toMessageDto(message)),
    };
  }

  async markJobRead(jobId: string, userId: string) {
    await this.getConversationOrThrow(jobId, userId);
    const readAt = new Date();
    const updated = await this.prisma.jobMessage.updateMany({
      where: {
        jobId,
        recipientUserId: userId,
        readAt: null,
      },
      data: {
        readAt,
      },
    });

    return {
      updatedCount: updated.count,
      readAt: readAt.toISOString(),
    };
  }

  async send(jobId: string, userId: string, dto: CreateJobMessageDto) {
    const content = dto.content.trim();
    if (content.length === 0) {
      throw new BadRequestException('content should not be empty');
    }

    const access = await this.getConversationOrThrow(jobId, userId);
    if (access.job.status === 'CANCELED') {
      throw new ConflictException(
        'Canceled jobs are no longer open for new messages',
      );
    }

    const moderation = await this.trustSafetyService.evaluateMessageAttempt({
      jobId,
      requestId: access.job.requestId,
      actorUserId: userId,
      counterpartUserId: access.counterpart.id,
      actorRole: access.role,
      contactUnlocked: access.contactUnlocked,
      content,
    });

    if (moderation.status === 'warning' || moderation.status === 'blocked') {
      return moderation;
    }

    const created = await this.prisma.jobMessage.create({
      data: {
        jobId,
        senderUserId: userId,
        recipientUserId: access.counterpart.id,
        content,
      },
    });

    const href =
      access.role === 'customer'
        ? `/pro/mensagens?job=${jobId}`
        : `/app/mensagens?job=${jobId}`;
    const actorName =
      access.role === 'customer'
        ? access.customer.name?.trim() || 'Cliente'
        : access.provider.name?.trim() || 'Prestador';

    await this.notificationsService.create({
      userId: access.counterpart.id,
      actorUserId: userId,
      kind: 'JOB_MESSAGE_RECEIVED',
      tone: 'INFO',
      title: `Nova mensagem sobre "${access.job.title}"`,
      description: `${actorName} enviou uma nova mensagem no teu job.`,
      href,
      hrefLabel: 'Abrir conversa',
      metadata: {
        jobId,
      } satisfies Prisma.JsonObject,
    });

    return {
      status: 'sent' as const,
      message: this.toMessageDto(created),
    };
  }

  private async getConversationOrThrow(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: messageJobInclude,
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.resolveConversationAccess(job, userId);
  }

  private resolveConversationAccess(
    job: MessageJob,
    userId: string,
  ): AccessibleConversation {
    const provider = job.provider ?? job.workerProfile.user;
    const customer = job.customer ?? job.client;

    if (!provider || !customer) {
      throw new ConflictException(
        'Conversation participants are not available',
      );
    }

    const providerUserId =
      provider.id ?? job.providerId ?? job.workerProfile.userId;
    const isCustomer = job.clientId === userId || job.customerId === userId;
    const isProvider = providerUserId === userId;

    if (!isCustomer && !isProvider) {
      throw new ForbiddenException('You are not allowed to access this job');
    }

    const contactUnlocked = Boolean(
      job.contactUnlockedAt || job.paymentIntents.length > 0,
    );

    return {
      job,
      role: isCustomer ? 'customer' : 'provider',
      customer,
      provider,
      counterpart: isCustomer ? provider : customer,
      contactUnlocked,
    };
  }

  private toParticipantDto(user: Participant, contactUnlocked: boolean) {
    return {
      id: user.id,
      name: user.name,
      email: contactUnlocked ? user.email : null,
    };
  }

  private toMessageDto(message: {
    id: string;
    jobId: string;
    senderUserId: string;
    recipientUserId: string;
    content: string;
    createdAt: Date;
    readAt: Date | null;
  }) {
    return {
      id: message.id,
      jobId: message.jobId,
      senderUserId: message.senderUserId,
      recipientUserId: message.recipientUserId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt ? message.readAt.toISOString() : null,
    };
  }
}
