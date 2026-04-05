import { API_URL } from '@/lib/auth';
import { Job } from '@/lib/jobs';
import { readApiError } from '@/lib/http-errors';
import { PaginatedResponse } from '@/lib/pagination';

export type AdminOpsJobsByStatus = {
  REQUESTED: number;
  ACCEPTED: number;
  IN_PROGRESS: number;
  COMPLETED: number;
  CANCELED: number;
};

export type AdminOpsJobsByPricingMode = {
  FIXED_PRICE: number;
  QUOTE_REQUEST: number;
};

export type AdminOpsKpis = {
  totalJobs: number;
  jobsByStatus: AdminOpsJobsByStatus;
  completionRate: number;
  totalReviews: number;
  averageRating: number;
  activePublicableWorkers: number;
  jobsByPricingMode: AdminOpsJobsByPricingMode;
};

export type AdminOpsJobListItem = Pick<
  Job,
  | 'id'
  | 'title'
  | 'status'
  | 'pricingMode'
  | 'clientId'
  | 'workerProfileId'
  | 'budget'
  | 'quotedAmount'
  | 'cancelReason'
  | 'createdAt'
  | 'acceptedAt'
  | 'startedAt'
  | 'completedAt'
  | 'canceledAt'
> & {
  hasReview: boolean;
};

export type AdminOpsOverview = {
  kpis: AdminOpsKpis;
  recentJobs: AdminOpsJobListItem[];
  recentlyCanceledJobs: AdminOpsJobListItem[];
  completedWithoutReviewJobs: AdminOpsJobListItem[];
};

export type AdminAuditStatus = 'SUCCESS' | 'DENIED' | 'FAILED';

export type AdminAuditLog = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  status: AdminAuditStatus;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  route: string;
  method: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ListAdminAuditLogsQuery = {
  page?: number;
  limit?: number;
  action?: string;
  status?: AdminAuditStatus;
  actorUserId?: string;
};

function buildAuditQuery(query?: ListAdminAuditLogsQuery): string {
  const params = new URLSearchParams();

  if (typeof query?.page === 'number') {
    params.set('page', String(query.page));
  }

  if (typeof query?.limit === 'number') {
    params.set('limit', String(query.limit));
  }

  if (query?.action) {
    params.set('action', query.action);
  }

  if (query?.status) {
    params.set('status', query.status);
  }

  if (query?.actorUserId) {
    params.set('actorUserId', query.actorUserId);
  }

  return params.size > 0 ? `?${params.toString()}` : '';
}

export async function getAdminOpsOverview(
  accessToken: string,
): Promise<AdminOpsOverview> {
  const response = await fetch(`${API_URL}/admin/ops/overview`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as AdminOpsOverview;
}

export async function listAdminAuditLogs(
  accessToken: string,
  query?: ListAdminAuditLogsQuery,
): Promise<PaginatedResponse<AdminAuditLog>> {
  const response = await fetch(
    `${API_URL}/admin/ops/audit-logs${buildAuditQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<AdminAuditLog>;
}
