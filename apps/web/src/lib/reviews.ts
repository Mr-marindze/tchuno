import { API_URL } from "@/lib/auth";

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

type ApiErrorBody = {
  message?: string | string[];
};

async function readError(response: Response): Promise<string> {
  let detail = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      detail = body.message.join(", ");
    } else if (body.message) {
      detail = body.message;
    }
  } catch {
    // Keep fallback detail if API does not return JSON.
  }

  return detail;
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
    throw new Error(await readError(response));
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
    throw new Error(await readError(response));
  }

  return (await response.json()) as Review[];
}

export async function listWorkerReviews(
  workerProfileId: string,
): Promise<Review[]> {
  const response = await fetch(`${API_URL}/reviews/worker/${workerProfileId}`);

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as Review[];
}
