import { API_URL } from "@/lib/auth";
import { readApiError } from "@/lib/http-errors";

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

export async function listMyReviews(accessToken: string): Promise<Review[]> {
  const response = await fetch(`${API_URL}/reviews/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Review[];
}

export async function listWorkerReviews(
  workerProfileId: string,
): Promise<Review[]> {
  const response = await fetch(`${API_URL}/reviews/worker/${workerProfileId}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Review[];
}
