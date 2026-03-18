import { API_URL } from "@/lib/auth";
import { readApiError } from "@/lib/http-errors";
import { PaginatedResponse } from "@/lib/pagination";

export type Review = {
  id: string;
  jobId: string;
  workerProfileId: string;
  reviewerId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReviewInput = {
  jobId: string;
  rating: number;
  comment?: string;
};

export type ListReviewsQuery = {
  rating?: number;
  sort?: "createdAt:asc" | "createdAt:desc" | "rating:asc" | "rating:desc";
  page?: number;
  limit?: number;
};

function buildQueryString(query?: ListReviewsQuery): string {
  const params = new URLSearchParams();

  if (typeof query?.rating === "number") {
    params.set("rating", String(query.rating));
  }

  if (query?.sort) {
    params.set("sort", query.sort);
  }

  if (typeof query?.page === "number") {
    params.set("page", String(query.page));
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  return params.size > 0 ? `?${params.toString()}` : "";
}

export async function createReview(
  accessToken: string,
  input: CreateReviewInput,
): Promise<Review> {
  const response = await fetch(`${API_URL}/reviews`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Review;
}

export async function listMyReviews(
  accessToken: string,
  query?: ListReviewsQuery,
): Promise<PaginatedResponse<Review>> {
  const response = await fetch(
    `${API_URL}/reviews/me${buildQueryString(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<Review>;
}

export async function listWorkerReviews(
  workerProfileId: string,
  query?: ListReviewsQuery,
): Promise<PaginatedResponse<Review>> {
  const response = await fetch(
    `${API_URL}/reviews/worker/${workerProfileId}${buildQueryString(query)}`,
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<Review>;
}
