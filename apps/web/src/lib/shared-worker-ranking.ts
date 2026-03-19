import { API_URL } from "@/lib/auth";
import { readApiError } from "@/lib/http-errors";
import { PaginatedResponse } from "@/lib/pagination";

export type SharedWorkerRankingItem = {
  workerProfileId: string;
  score: number;
  qualityComponent: number;
  behaviorComponent: number;
  stabilityMultiplier: number;
  decayMultiplier: number;
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
  ratingAvg: number;
  ratingCount: number;
  isAvailable: boolean;
  lastEventAt: string | null;
};

export type ListSharedWorkerRankingQuery = {
  page?: number;
  limit?: number;
  includeUnavailable?: boolean;
};

export async function listSharedWorkerRanking(
  query?: ListSharedWorkerRankingQuery,
): Promise<PaginatedResponse<SharedWorkerRankingItem>> {
  const params = new URLSearchParams();

  if (typeof query?.page === "number") {
    params.set("page", String(query.page));
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  if (typeof query?.includeUnavailable === "boolean") {
    params.set("includeUnavailable", String(query.includeUnavailable));
  }

  const path = params.size > 0 ? `?${params.toString()}` : "";

  const response = await fetch(`${API_URL}/tracking/ranking/workers${path}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<SharedWorkerRankingItem>;
}
