import { API_URL } from '@/lib/auth';
import { readApiError } from '@/lib/http-errors';
import { PaginatedResponse } from '@/lib/pagination';

export type PaymentIntentStatus =
  | 'CREATED'
  | 'AWAITING_PAYMENT'
  | 'PENDING_CONFIRMATION'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELED';

export type PaymentTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVERSED'
  | 'CANCELED';

export type PaymentTransaction = {
  id: string;
  paymentIntentId: string | null;
  type: 'CHARGE' | 'PAYOUT' | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT';
  status: PaymentTransactionStatus;
  provider: 'INTERNAL' | 'MPESA' | 'EMOLA' | 'MKESH' | 'BANK_TRANSFER' | 'MANUAL';
  providerReference: string | null;
  requestedAmount: number;
  confirmedAmount: number | null;
  currency: string;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type PaymentIntent = {
  id: string;
  jobId: string;
  customerId: string;
  providerUserId: string | null;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  providerNetAmount: number;
  status: PaymentIntentStatus;
  provider: 'INTERNAL' | 'MPESA' | 'EMOLA' | 'MKESH' | 'BANK_TRANSFER' | 'MANUAL';
  createdAt: string;
  updatedAt: string;
  transactions: PaymentTransaction[];
};

export type ProviderEarningsSummary = {
  balances: {
    held: number;
    available: number;
    paidOut: number;
  };
  entries: Array<{
    id: string;
    entryType: string;
    amount: number;
    direction: 'DEBIT' | 'CREDIT';
    bucket: string;
    createdAt: string;
    paymentIntentId: string | null;
    jobId: string | null;
    description: string | null;
  }>;
  payouts: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
    processedAt: string | null;
    providerReference: string | null;
  }>;
};

type ListPaymentsQuery = {
  page?: number;
  limit?: number;
  status?: string;
};

function buildQuery(query?: ListPaymentsQuery): string {
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

  if (params.size === 0) {
    return '';
  }

  return `?${params.toString()}`;
}

export async function listMyCustomerPaymentIntents(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<PaymentIntent>> {
  const response = await fetch(`${API_URL}/payments/me${buildQuery(query)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<PaymentIntent>;
}

export async function getProviderEarningsSummary(
  accessToken: string,
): Promise<ProviderEarningsSummary> {
  const response = await fetch(`${API_URL}/payments/provider/summary`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as ProviderEarningsSummary;
}
