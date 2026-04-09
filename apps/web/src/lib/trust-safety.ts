import { API_URL } from '@/lib/auth';
import { parseApiError, toApiError } from '@/lib/http-errors';
import type { TrustSafetyIntervention } from '@/lib/messages';
import { PaginatedResponse } from '@/lib/pagination';

export type AdminTrustSafetyIntervention = TrustSafetyIntervention & {
  job: {
    id: string;
    requestId: string | null;
    title: string;
    status: string;
  };
  actorUser: {
    id: string;
    name: string | null;
    email: string;
  };
  counterpartUser: {
    id: string;
    name: string | null;
    email: string;
  };
  reviewedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export async function listAdminTrustSafetyInterventions(
  accessToken: string,
  query?: {
    page?: number;
    limit?: number;
    status?: string;
  },
): Promise<
  PaginatedResponse<AdminTrustSafetyIntervention> & {
    summary: {
      openCount: number;
      appealedCount: number;
      highRiskCount: number;
    };
  }
> {
  const params = new URLSearchParams();
  if (typeof query?.page === 'number') {
    params.set('page', String(query.page));
  }
  if (typeof query?.limit === 'number') {
    params.set('limit', String(query.limit));
  }
  if (query?.status) {
    params.set('status', query.status);
  }

  const response = await fetch(
    `${API_URL}/admin/trust-safety/interventions${
      params.size > 0 ? `?${params.toString()}` : ''
    }`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as PaginatedResponse<AdminTrustSafetyIntervention> & {
    summary: {
      openCount: number;
      appealedCount: number;
      highRiskCount: number;
    };
  };
}

export async function reviewAdminTrustSafetyIntervention(
  accessToken: string,
  interventionId: string,
  input: {
    decision: 'CLEARED' | 'ENFORCED';
    resolutionNote?: string;
  },
): Promise<AdminTrustSafetyIntervention> {
  const response = await fetch(
    `${API_URL}/admin/trust-safety/interventions/${interventionId}/review`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as AdminTrustSafetyIntervention;
}
