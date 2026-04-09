import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserNotificationKind,
  UserNotificationTone,
} from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

type NotificationRecord = {
  id: string;
  kind: UserNotificationKind;
  tone: UserNotificationTone;
  title: string;
  description: string;
  href: string;
  hrefLabel: string | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Prisma.JsonValue | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, query: ListNotificationsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.UserNotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.userNotification.count({ where }),
      this.prisma.userNotification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
      this.prisma.userNotification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      ...buildPaginatedResponse({
        data: items.map((item) => this.toDto(item)),
        total,
        page,
        limit,
      }),
      unreadCount,
    };
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.userNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to access this notification',
      );
    }

    if (notification.readAt) {
      return this.toDto(notification);
    }

    const updated = await this.prisma.userNotification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
      },
    });

    return this.toDto(updated);
  }

  async markAllRead(userId: string) {
    const updatedAt = new Date();
    const result = await this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: updatedAt,
      },
    });

    return {
      markedCount: result.count,
      updatedAt: updatedAt.toISOString(),
    };
  }

  async create(input: {
    userId: string;
    actorUserId?: string | null;
    kind: UserNotificationKind;
    tone?: UserNotificationTone;
    title: string;
    description: string;
    href: string;
    hrefLabel?: string | null;
    metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }) {
    const created = await this.prisma.userNotification.create({
      data: {
        userId: input.userId,
        actorUserId: input.actorUserId ?? null,
        kind: input.kind,
        tone: input.tone ?? 'INFO',
        title: input.title,
        description: input.description,
        href: input.href,
        hrefLabel: input.hrefLabel ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });

    return this.toDto(created);
  }

  private toDto(item: NotificationRecord) {
    return {
      id: item.id,
      kind: item.kind,
      tone: this.mapTone(item.tone),
      title: item.title,
      description: item.description,
      href: item.href,
      hrefLabel: item.hrefLabel ?? 'Abrir',
      readAt: item.readAt ? item.readAt.toISOString() : null,
      unread: !item.readAt,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      metadata: item.metadata,
    };
  }

  private mapTone(tone: UserNotificationTone) {
    if (tone === 'ATTENTION') {
      return 'attention' as const;
    }

    if (tone === 'SUCCESS') {
      return 'success' as const;
    }

    if (tone === 'MUTED') {
      return 'muted' as const;
    }

    return 'info' as const;
  }
}
