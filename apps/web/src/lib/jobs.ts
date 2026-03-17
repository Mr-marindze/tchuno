import { API_URL } from "@/lib/auth";
import { readApiError } from "@/lib/http-errors";

export type JobStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED";

export type Job = {
  id: string;
  clientId: string;
  workerProfileId: string;
  categoryId: string;
  pricingMode: "FIXED_PRICE" | "QUOTE_REQUEST";
  title: string;
  description: string;
  budget: number | null;
  quotedAmount: number | null;
  status: JobStatus;
  acceptedAt: string | null;
  startedAt: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  canceledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateJobInput = {
  workerProfileId: string;
  categoryId: string;
  title: string;
  description: string;
  pricingMode?: "FIXED_PRICE" | "QUOTE_REQUEST";
  budget?: number;
  scheduledFor?: string;
};

export type ListJobsQuery = {
  status?: JobStatus;
  limit?: number;
  offset?: number;
};

function buildQueryString(query?: ListJobsQuery): string {
  const params = new URLSearchParams();

  if (query?.status) {
    params.set("status", query.status);
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  if (typeof query?.offset === "number") {
    params.set("offset", String(query.offset));
  }

  return params.size > 0 ? `?${params.toString()}` : "";
}

export async function createJob(
  accessToken: string,
  input: CreateJobInput,
): Promise<Job> {
  const response = await fetch(`${API_URL}/jobs`, {
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

  return (await response.json()) as Job;
}

export async function listMyClientJobs(
  accessToken: string,
  query?: ListJobsQuery,
): Promise<Job[]> {
  const response = await fetch(
    `${API_URL}/jobs/me/client${buildQueryString(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Job[];
}

export async function listMyWorkerJobs(
  accessToken: string,
  query?: ListJobsQuery,
): Promise<Job[]> {
  const response = await fetch(
    `${API_URL}/jobs/me/worker${buildQueryString(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Job[];
}

export async function updateJobStatus(
  accessToken: string,
  jobId: string,
  status: JobStatus,
  options?: {
    quotedAmount?: number;
    cancelReason?: string;
  },
): Promise<Job> {
  const response = await fetch(`${API_URL}/jobs/${jobId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
      quotedAmount: options?.quotedAmount,
      cancelReason: options?.cancelReason,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Job;
}
