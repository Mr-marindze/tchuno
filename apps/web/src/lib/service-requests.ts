import { API_URL } from '@/lib/auth';
import { readApiError } from '@/lib/http-errors';
import { PaginatedResponse } from '@/lib/pagination';

export type ServiceRequestStatus = 'OPEN' | 'CLOSED' | 'EXPIRED';
export type ProposalStatus = 'SUBMITTED' | 'SELECTED' | 'REJECTED';

export type ServiceRequest = {
  id: string;
  customerId: string;
  categoryId: string;
  title: string;
  description: string;
  location: string | null;
  status: ServiceRequestStatus;
  selectedProposalId: string | null;
  createdAt: string;
  updatedAt: string;
  proposals?: Array<{
    id: string;
    providerId: string;
    price: number;
    status: ProposalStatus;
    createdAt: string;
  }>;
  job?: {
    id: string;
    status: string;
    contactUnlockedAt: string | null;
    agreedPrice: number | null;
  } | null;
};

export type Proposal = {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  comment: string | null;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  provider?: {
    id: string;
    name: string | null;
    workerProfile: {
      ratingAvg: string;
      ratingCount: number;
      location: string | null;
    } | null;
  };
};

export type CreateServiceRequestInput = {
  categoryId: string;
  title: string;
  description: string;
  location?: string;
};

export type SubmitProposalInput = {
  price: number;
  comment?: string;
};

export type ListServiceRequestsQuery = {
  status?: ServiceRequestStatus;
  search?: string;
  page?: number;
  limit?: number;
};

function buildQuery(query?: ListServiceRequestsQuery): string {
  const params = new URLSearchParams();

  if (query?.status) {
    params.set('status', query.status);
  }

  if (query?.search) {
    params.set('search', query.search);
  }

  if (typeof query?.page === 'number') {
    params.set('page', String(query.page));
  }

  if (typeof query?.limit === 'number') {
    params.set('limit', String(query.limit));
  }

  return params.size > 0 ? `?${params.toString()}` : '';
}

export async function createServiceRequest(
  accessToken: string,
  input: CreateServiceRequestInput,
): Promise<ServiceRequest> {
  const response = await fetch(`${API_URL}/service-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as ServiceRequest;
}

export async function listMyServiceRequests(
  accessToken: string,
  query?: ListServiceRequestsQuery,
): Promise<PaginatedResponse<ServiceRequest>> {
  const response = await fetch(
    `${API_URL}/service-requests/me${buildQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<ServiceRequest>;
}

export async function listOpenServiceRequests(
  accessToken: string,
  query?: ListServiceRequestsQuery,
): Promise<PaginatedResponse<ServiceRequest>> {
  const response = await fetch(
    `${API_URL}/service-requests/open${buildQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<ServiceRequest>;
}

export async function submitProposal(
  accessToken: string,
  requestId: string,
  input: SubmitProposalInput,
): Promise<Proposal> {
  const response = await fetch(`${API_URL}/service-requests/${requestId}/proposals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Proposal;
}

export async function listRequestProposals(
  accessToken: string,
  requestId: string,
): Promise<Proposal[]> {
  const response = await fetch(`${API_URL}/service-requests/${requestId}/proposals`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Proposal[];
}

export async function selectProposal(
  accessToken: string,
  requestId: string,
  proposalId: string,
  input?: { depositPercent?: number },
): Promise<{
  request: ServiceRequest;
  selectedProposalId: string;
  job: {
    id: string;
    status: string;
    requestId: string | null;
  };
  paymentIntent: {
    id: string;
    amount: number;
    status: string;
  } | null;
  idempotent: boolean;
}> {
  const response = await fetch(
    `${API_URL}/service-requests/${requestId}/select/${proposalId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input ?? {}),
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as {
    request: ServiceRequest;
    selectedProposalId: string;
    job: {
      id: string;
      status: string;
      requestId: string | null;
    };
    paymentIntent: {
      id: string;
      amount: number;
      status: string;
    } | null;
    idempotent: boolean;
  };
}
