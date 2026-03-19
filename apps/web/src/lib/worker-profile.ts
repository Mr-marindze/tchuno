import { API_URL } from "@/lib/auth";
import { readApiError } from "@/lib/http-errors";
import { PaginatedResponse } from "@/lib/pagination";

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
  search?: string;
  sort?:
    | "updatedAt:asc"
    | "updatedAt:desc"
    | "rating:asc"
    | "rating:desc"
    | "hourlyRate:asc"
    | "hourlyRate:desc";
  page?: number;
  limit?: number;
};

export type UpsertWorkerProfileInput = {
  bio?: string;
  location?: string;
  hourlyRate?: number;
  experienceYears?: number;
  isAvailable?: boolean;
  categoryIds?: string[];
};

export async function listWorkerProfiles(
  query?: ListWorkerProfilesQuery,
): Promise<PaginatedResponse<WorkerProfile>> {
  const params = new URLSearchParams();

  if (query?.categorySlug) {
    params.set("categorySlug", query.categorySlug);
  }

  if (typeof query?.isAvailable === "boolean") {
    params.set("isAvailable", String(query.isAvailable));
  }

  if (query?.search) {
    params.set("search", query.search);
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

  const path = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`${API_URL}/worker-profile${path}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<WorkerProfile>;
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
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as WorkerProfile;
}

export async function getWorkerProfileByUserId(
  userId: string,
): Promise<WorkerProfile> {
  const response = await fetch(`${API_URL}/worker-profile/${userId}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
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
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as WorkerProfile;
}
