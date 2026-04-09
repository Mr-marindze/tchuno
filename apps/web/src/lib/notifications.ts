import { API_URL } from '@/lib/auth';
import { readApiError } from '@/lib/http-errors';
import type { PaginatedResponse } from '@/lib/pagination';

export type InboxNotificationTone = 'attention' | 'success' | 'info' | 'muted';

export type InboxNotification = {
  id: string;
  kind: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  tone: InboxNotificationTone;
  readAt?: string | null;
  unread?: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata?: unknown;
};

export type NotificationListResponse = PaginatedResponse<InboxNotification> & {
  unreadCount: number;
};

export type ListNotificationsQuery = {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
};

function buildQuery(query?: ListNotificationsQuery): string {
  const params = new URLSearchParams();

  if (typeof query?.page === 'number') {
    params.set('page', String(query.page));
  }

  if (typeof query?.limit === 'number') {
    params.set('limit', String(query.limit));
  }

  if (typeof query?.unreadOnly === 'boolean') {
    params.set('unreadOnly', String(query.unreadOnly));
  }

  return params.size > 0 ? `?${params.toString()}` : '';
}

export async function listMyNotifications(
  accessToken: string,
  query?: ListNotificationsQuery,
): Promise<NotificationListResponse> {
  const response = await fetch(`${API_URL}/notifications/me${buildQuery(query)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as NotificationListResponse;
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: string,
): Promise<InboxNotification> {
  const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as InboxNotification;
}

export async function markAllNotificationsRead(
  accessToken: string,
): Promise<{
  markedCount: number;
  updatedAt: string;
}> {
  const response = await fetch(`${API_URL}/notifications/me/read-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as {
    markedCount: number;
    updatedAt: string;
  };
}
