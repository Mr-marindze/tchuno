import { API_URL } from "@/lib/auth";
import { Job } from "@/lib/jobs";
import { readApiError } from "@/lib/http-errors";

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
  | "id"
  | "title"
  | "status"
  | "pricingMode"
  | "clientId"
  | "workerProfileId"
  | "budget"
  | "quotedAmount"
  | "cancelReason"
  | "createdAt"
  | "acceptedAt"
  | "startedAt"
  | "completedAt"
  | "canceledAt"
> & {
  hasReview: boolean;
};

export type AdminOpsOverview = {
  kpis: AdminOpsKpis;
  recentJobs: AdminOpsJobListItem[];
  recentlyCanceledJobs: AdminOpsJobListItem[];
  completedWithoutReviewJobs: AdminOpsJobListItem[];
};

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
