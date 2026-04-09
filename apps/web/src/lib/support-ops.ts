import { API_URL } from '@/lib/auth';
import { parseApiError, toApiError } from '@/lib/http-errors';
import { PaginatedResponse } from '@/lib/pagination';

export type OperationalIncidentStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'MITIGATING'
  | 'MONITORING'
  | 'RESOLVED'
  | 'CANCELED';

export type OperationalIncidentSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type OperationalIncidentSource =
  | 'SUPPORT'
  | 'REFUND_DISPUTE'
  | 'TRUST_SAFETY'
  | 'PLATFORM';

export type OperationalIncident = {
  id: string;
  title: string;
  summary: string;
  source: OperationalIncidentSource;
  severity: OperationalIncidentSeverity;
  status: OperationalIncidentStatus;
  impactedArea: string | null;
  customerImpact: string | null;
  evidenceItems: string[];
  resolutionNote: string | null;
  createdByUserId: string;
  ownerAdminUserId: string | null;
  relatedJobId: string | null;
  relatedRefundRequestId: string | null;
  relatedTrustSafetyInterventionId: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  ownerAdminUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  relatedJob: {
    id: string;
    title: string;
    status: string;
    requestId: string | null;
  } | null;
  relatedRefundRequest: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    reason: string;
  } | null;
  relatedTrustSafetyIntervention: {
    id: string;
    status: string;
    riskLevel: string;
    reasonSummary: string;
    jobId: string;
  } | null;
};

export async function listOperationalIncidents(
  accessToken: string,
  query?: {
    page?: number;
    limit?: number;
    status?: OperationalIncidentStatus;
    source?: OperationalIncidentSource;
  },
): Promise<
  PaginatedResponse<OperationalIncident> & {
    summary: {
      unresolvedCount: number;
      criticalCount: number;
      resolvedCount: number;
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
  if (query?.source) {
    params.set('source', query.source);
  }

  const response = await fetch(
    `${API_URL}/admin/support/incidents${
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

  return (await response.json()) as PaginatedResponse<OperationalIncident> & {
    summary: {
      unresolvedCount: number;
      criticalCount: number;
      resolvedCount: number;
    };
  };
}

export async function createOperationalIncident(
  accessToken: string,
  input: {
    title: string;
    summary: string;
    source?: OperationalIncidentSource;
    severity?: OperationalIncidentSeverity;
    impactedArea?: string;
    customerImpact?: string;
    evidenceItems?: string[];
    relatedJobId?: string;
    relatedRefundRequestId?: string;
    relatedTrustSafetyInterventionId?: string;
  },
): Promise<OperationalIncident> {
  const response = await fetch(`${API_URL}/admin/support/incidents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as OperationalIncident;
}

export async function updateOperationalIncident(
  accessToken: string,
  incidentId: string,
  input: {
    title?: string;
    summary?: string;
    source?: OperationalIncidentSource;
    severity?: OperationalIncidentSeverity;
    status?: OperationalIncidentStatus;
    impactedArea?: string;
    customerImpact?: string;
    evidenceItems?: string[];
    resolutionNote?: string;
  },
): Promise<OperationalIncident> {
  const response = await fetch(`${API_URL}/admin/support/incidents/${incidentId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as OperationalIncident;
}
