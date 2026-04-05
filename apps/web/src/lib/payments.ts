import { API_URL } from '@/lib/auth';
import { parseApiError, readApiError, toApiError } from '@/lib/http-errors';
import { PaginatedResponse } from '@/lib/pagination';

export type PaymentIntentStatus =
  | 'CREATED'
  | 'AWAITING_PAYMENT'
  | 'PAID_PARTIAL'
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

export type RefundRequest = {
  id: string;
  jobId: string;
  paymentIntentId: string;
  transactionId: string | null;
  requestedByUserId: string;
  approvedByUserId: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  provider: 'INTERNAL' | 'MPESA' | 'EMOLA' | 'MKESH' | 'BANK_TRANSFER' | 'MANUAL';
  providerReference: string | null;
  processedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payout = {
  id: string;
  providerUserId: string;
  jobId: string | null;
  paymentIntentId: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: 'INTERNAL' | 'MPESA' | 'EMOLA' | 'MKESH' | 'BANK_TRANSFER' | 'MANUAL';
  providerReference: string | null;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  processedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
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

export type JobFinancialState = {
  jobId: string;
  jobStatus: string;
  paymentState: string;
  intents: PaymentIntent[];
};

export type AdminPaymentsOverview = {
  kpis: {
    totalIntents: number;
    intentsAwaitingPayment: number;
    intentsSucceeded: number;
    intentsFailed: number;
    totalTransactions: number;
    failedTransactions: number;
    pendingRefunds: number;
    pendingPayouts: number;
    platformReserved: number;
    providerHeld: number;
    providerAvailable: number;
    releaseDelayHours: number;
  };
};

type ListPaymentsQuery = {
  page?: number;
  limit?: number;
  status?: string;
};

type AdminRequestOptions = {
  reauthToken?: string;
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

export async function payPaymentIntent(
  accessToken: string,
  paymentIntentId: string,
  input?: {
    idempotencyKey?: string;
    simulate?: 'success' | 'pending' | 'failed' | 'reversed';
  },
): Promise<PaymentIntent> {
  const response = await fetch(`${API_URL}/payments/intents/${paymentIntentId}/pay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input ?? {}),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaymentIntent;
}

export async function getJobFinancialState(
  accessToken: string,
  jobId: string,
): Promise<JobFinancialState> {
  const response = await fetch(`${API_URL}/payments/jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as JobFinancialState;
}

export async function getAdminPaymentsOverview(
  accessToken: string,
): Promise<AdminPaymentsOverview> {
  const response = await fetch(`${API_URL}/admin/payments/overview`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as AdminPaymentsOverview;
}

export async function listAdminPaymentIntents(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<PaymentIntent>> {
  const response = await fetch(
    `${API_URL}/admin/payments/intents${buildQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<PaymentIntent>;
}

export async function listAdminPaymentTransactions(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<PaymentTransaction>> {
  const response = await fetch(
    `${API_URL}/admin/payments/transactions${buildQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<PaymentTransaction>;
}

export async function listAdminRefundRequests(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<RefundRequest>> {
  const response = await fetch(
    `${API_URL}/admin/payments/refunds${buildQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<RefundRequest>;
}

export async function listAdminPayouts(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<Payout>> {
  const response = await fetch(
    `${API_URL}/admin/payments/payouts${buildQuery(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PaginatedResponse<Payout>;
}

export async function reconcileAdminTransaction(
  accessToken: string,
  transactionId: string,
  input?: {
    simulate?: 'success' | 'pending' | 'failed' | 'reversed';
  },
): Promise<PaymentTransaction> {
  const response = await fetch(
    `${API_URL}/payments/transactions/${transactionId}/reconcile`,
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

  return (await response.json()) as PaymentTransaction;
}

export async function reconcileAdminPendingCharges(
  accessToken: string,
  input?: {
    limit?: number;
    minAgeMinutes?: number;
  },
): Promise<{
  source: string;
  scanned: number;
  reconciled: number;
  succeeded: number;
  failed: number;
  reversed: number;
  stillPending: number;
  errors: Array<{ transactionId: string; reason: string }>;
}> {
  const response = await fetch(`${API_URL}/admin/payments/reconcile/pending`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input ?? {}),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as {
    source: string;
    scanned: number;
    reconciled: number;
    succeeded: number;
    failed: number;
    reversed: number;
    stillPending: number;
    errors: Array<{ transactionId: string; reason: string }>;
  };
}

export async function createAdminRefund(
  accessToken: string,
  input: {
    paymentIntentId: string;
    reason: string;
    amount?: number;
  },
  options?: AdminRequestOptions,
): Promise<RefundRequest> {
  const response = await fetch(`${API_URL}/admin/payments/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.reauthToken
        ? {
            'x-reauth-token': options.reauthToken,
          }
        : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as RefundRequest;
}

export async function createAdminPayout(
  accessToken: string,
  input: {
    providerUserId: string;
    amount: number;
    paymentIntentId?: string;
    jobId?: string;
    currency?: string;
    provider?: 'INTERNAL' | 'MPESA' | 'EMOLA' | 'MKESH' | 'BANK_TRANSFER' | 'MANUAL';
  },
  options?: AdminRequestOptions,
): Promise<Payout> {
  const response = await fetch(`${API_URL}/admin/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.reauthToken
        ? {
            'x-reauth-token': options.reauthToken,
          }
        : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as Payout;
}

export async function approveAdminPayout(
  accessToken: string,
  payoutId: string,
  options?: AdminRequestOptions,
): Promise<Payout> {
  const response = await fetch(`${API_URL}/admin/payments/payouts/${payoutId}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.reauthToken
        ? {
            'x-reauth-token': options.reauthToken,
          }
        : {}),
    },
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as Payout;
}

export async function processAdminPayout(
  accessToken: string,
  payoutId: string,
  input?: {
    simulate?: 'success' | 'pending' | 'failed';
    providerReference?: string;
  },
  options?: AdminRequestOptions,
): Promise<Payout> {
  const response = await fetch(`${API_URL}/admin/payments/payouts/${payoutId}/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.reauthToken
        ? {
            'x-reauth-token': options.reauthToken,
          }
        : {}),
    },
    body: JSON.stringify(input ?? {}),
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as Payout;
}

export async function releaseAdminFunds(
  accessToken: string,
  jobId: string,
  options?: AdminRequestOptions,
): Promise<{
  jobId: string;
  paymentIntentId: string;
  releasedAmount: number;
  currency: string;
}> {
  const response = await fetch(`${API_URL}/admin/payments/release/${jobId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.reauthToken
        ? {
            'x-reauth-token': options.reauthToken,
          }
        : {}),
    },
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as {
    jobId: string;
    paymentIntentId: string;
    releasedAmount: number;
    currency: string;
  };
}
