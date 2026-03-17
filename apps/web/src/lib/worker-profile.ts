import { API_URL } from "@/lib/auth";

export type WorkerProfileCategoryItem = {
  id: string;
  name: string;
  slug: string;
};

export type WorkerProfile = {
  id: string;
  userId: string;
  bio: string | null;
  location: string | null;
  hourlyRate: number | null;
  experienceYears: number;
  isAvailable: boolean;
  ratingAvg: string;
  ratingCount: number;
  categories: WorkerProfileCategoryItem[];
  createdAt: string;
  updatedAt: string;
};

export type ListWorkerProfilesQuery = {
  categorySlug?: string;
  isAvailable?: boolean;
  limit?: number;
  offset?: number;
};

export type UpsertWorkerProfileInput = {
  bio?: string;
  location?: string;
  hourlyRate?: number;
  experienceYears?: number;
  isAvailable?: boolean;
  categoryIds?: string[];
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

export async function listWorkerProfiles(
  query?: ListWorkerProfilesQuery,
): Promise<WorkerProfile[]> {
  const params = new URLSearchParams();

  if (query?.categorySlug) {
    params.set("categorySlug", query.categorySlug);
  }

  if (typeof query?.isAvailable === "boolean") {
    params.set("isAvailable", String(query.isAvailable));
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  if (typeof query?.offset === "number") {
    params.set("offset", String(query.offset));
  }

  const path = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`${API_URL}/worker-profile${path}`);

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as WorkerProfile[];
}

export async function getMyWorkerProfile(
  accessToken: string,
): Promise<WorkerProfile | null> {
  const response = await fetch(`${API_URL}/worker-profile/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as WorkerProfile;
}

export async function upsertMyWorkerProfile(
  accessToken: string,
  input: UpsertWorkerProfileInput,
): Promise<WorkerProfile> {
  const response = await fetch(`${API_URL}/worker-profile/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as WorkerProfile;
}
