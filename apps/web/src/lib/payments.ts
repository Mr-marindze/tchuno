import { apiFetch, API_URL } from '@/lib/auth';
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
  evidenceItems: string[];
  decisionNote: string | null;
  status: string;
  provider: 'INTERNAL' | 'MPESA' | 'EMOLA' | 'MKESH' | 'BANK_TRANSFER' | 'MANUAL';
  providerReference: string | null;
  processedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByUser?: {
    id: string;
    name: string | null;
  } | null;
  approvedByUser?: {
    id: string;
    name: string | null;
  } | null;
  supportCase?: {
    id: string;
    source: string;
    severity: string;
    status: string;
    baseSlaHours: number;
    slaTargetAt: string;
    isOverdue: boolean;
    detectedAt: string;
    assumedAt: string | null;
    resolvedAt: string | null;
    customerImpact: string | null;
    ownerAssigned: boolean;
    ownerAdminUser?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    resolutionNote?: string | null;
    timeline: Array<{
      id: string;
      eventType: string;
      visibility: 'INTERNAL' | 'PARTICIPANTS';
      title: string;
      description: string;
      actorName: string | null;
      createdAt: string;
    }>;
  } | null;
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
  refunds: RefundRequest[];
  cancellation: {
    canceledAt: string | null;
    canceledBy: string | null;
    cancelReason: string | null;
  };
  refundSummary: {
    stage: 'BEFORE_PAYMENT' | 'PRE_START' | 'IN_PROGRESS' | 'POST_COMPLETION';
    stageLabel: string;
    hasPaidDeposit: boolean;
    paidAmount: number;
    refundedAmount: number;
    remainingRefundableAmount: number;
    hasActiveRefund: boolean;
    canRequestRefund: boolean;
    canCancelJob: boolean;
    suggestedRefundAmount: number | null;
    suggestedRefundLabel: string | null;
    disputeWindowEndsAt: string | null;
    withinDisputeWindow: boolean;
    myPendingRefundRequestId: string | null;
  };
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

async function requestAuthedJson<T>(
  path: string,
  accessToken: string,
  options?: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
    body?: unknown;
    reauthToken?: string;
    useApiError?: boolean;
  },
): Promise<T> {
  const response = await apiFetch(`${API_URL}${path}`, {
    method: options?.method,
    accessToken,
    headers: {
      ...(options?.body !== undefined
        ? {
            'Content-Type': 'application/json',
          }
        : {}),
      ...(options?.reauthToken
        ? {
            'x-reauth-token': options.reauthToken,
          }
        : {}),
    },
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (options?.useApiError) {
      throw toApiError(await parseApiError(response));
    }

    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}

export async function listMyCustomerPaymentIntents(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<PaymentIntent>> {
  return requestAuthedJson<PaginatedResponse<PaymentIntent>>(
    `/payments/me${buildQuery(query)}`,
    accessToken,
  );
}

export async function getProviderEarningsSummary(
  accessToken: string,
): Promise<ProviderEarningsSummary> {
  return requestAuthedJson<ProviderEarningsSummary>(
    '/payments/provider/summary',
    accessToken,
  );
}

export async function payPaymentIntent(
  accessToken: string,
  paymentIntentId: string,
  input?: {
    idempotencyKey?: string;
    simulate?: 'success' | 'pending' | 'failed' | 'reversed';
  },
): Promise<PaymentIntent> {
  return requestAuthedJson<PaymentIntent>(
    `/payments/intents/${paymentIntentId}/pay`,
    accessToken,
    {
      method: 'POST',
      body: input ?? {},
    },
  );
}

export async function getJobFinancialState(
  accessToken: string,
  jobId: string,
): Promise<JobFinancialState> {
  return requestAuthedJson<JobFinancialState>(
    `/payments/jobs/${jobId}`,
    accessToken,
  );
}

export async function createJobRefundRequest(
  accessToken: string,
  jobId: string,
  input: {
    reason: string;
    amount?: number;
    evidenceItems?: string[];
  },
): Promise<RefundRequest> {
  return requestAuthedJson<RefundRequest>(
    `/payments/jobs/${jobId}/refund-requests`,
    accessToken,
    {
      method: 'POST',
      body: input,
    },
  );
}

export async function cancelMyRefundRequest(
  accessToken: string,
  refundRequestId: string,
): Promise<RefundRequest> {
  return requestAuthedJson<RefundRequest>(
    `/payments/refunds/${refundRequestId}/cancel`,
    accessToken,
    {
      method: 'POST',
    },
  );
}

export async function getAdminPaymentsOverview(
  accessToken: string,
): Promise<AdminPaymentsOverview> {
  return requestAuthedJson<AdminPaymentsOverview>(
    '/admin/payments/overview',
    accessToken,
  );
}

export async function listAdminPaymentIntents(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<PaymentIntent>> {
  return requestAuthedJson<PaginatedResponse<PaymentIntent>>(
    `/admin/payments/intents${buildQuery(query)}`,
    accessToken,
  );
}

export async function listAdminPaymentTransactions(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<PaymentTransaction>> {
  return requestAuthedJson<PaginatedResponse<PaymentTransaction>>(
    `/admin/payments/transactions${buildQuery(query)}`,
    accessToken,
  );
}

export async function listAdminRefundRequests(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<RefundRequest>> {
  return requestAuthedJson<PaginatedResponse<RefundRequest>>(
    `/admin/payments/refunds${buildQuery(query)}`,
    accessToken,
  );
}

export async function listAdminPayouts(
  accessToken: string,
  query?: ListPaymentsQuery,
): Promise<PaginatedResponse<Payout>> {
  return requestAuthedJson<PaginatedResponse<Payout>>(
    `/admin/payments/payouts${buildQuery(query)}`,
    accessToken,
  );
}

export async function reconcileAdminTransaction(
  accessToken: string,
  transactionId: string,
  input?: {
    simulate?: 'success' | 'pending' | 'failed' | 'reversed';
  },
): Promise<PaymentTransaction> {
  return requestAuthedJson<PaymentTransaction>(
    `/payments/transactions/${transactionId}/reconcile`,
    accessToken,
    {
      method: 'POST',
      body: input ?? {},
    },
  );
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
  return requestAuthedJson<{
    source: string;
    scanned: number;
    reconciled: number;
    succeeded: number;
    failed: number;
    reversed: number;
    stillPending: number;
    errors: Array<{ transactionId: string; reason: string }>;
  }>('/admin/payments/reconcile/pending', accessToken, {
    method: 'POST',
    body: input ?? {},
  });
}

export async function createAdminRefund(
  accessToken: string,
  input: {
    paymentIntentId: string;
    reason: string;
    amount?: number;
    evidenceItems?: string[];
  },
  options?: AdminRequestOptions,
): Promise<RefundRequest> {
  return requestAuthedJson<RefundRequest>('/admin/payments/refunds', accessToken, {
    method: 'POST',
    body: input,
    reauthToken: options?.reauthToken,
    useApiError: true,
  });
}

export async function approveAdminRefund(
  accessToken: string,
  refundRequestId: string,
  input?: {
    decisionNote?: string;
  },
  options?: AdminRequestOptions,
): Promise<RefundRequest> {
  return requestAuthedJson<RefundRequest>(
    `/admin/payments/refunds/${refundRequestId}/approve`,
    accessToken,
    {
      method: 'POST',
      body: input ?? {},
      reauthToken: options?.reauthToken,
      useApiError: true,
    },
  );
}

export async function rejectAdminRefund(
  accessToken: string,
  refundRequestId: string,
  input: {
    reason: string;
    decisionNote?: string;
  },
  options?: AdminRequestOptions,
): Promise<RefundRequest> {
  return requestAuthedJson<RefundRequest>(
    `/admin/payments/refunds/${refundRequestId}/reject`,
    accessToken,
    {
      method: 'POST',
      body: input,
      reauthToken: options?.reauthToken,
      useApiError: true,
    },
  );
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
  return requestAuthedJson<Payout>('/admin/payments/payouts', accessToken, {
    method: 'POST',
    body: input,
    reauthToken: options?.reauthToken,
    useApiError: true,
  });
}

export async function approveAdminPayout(
  accessToken: string,
  payoutId: string,
  options?: AdminRequestOptions,
): Promise<Payout> {
  return requestAuthedJson<Payout>(
    `/admin/payments/payouts/${payoutId}/approve`,
    accessToken,
    {
      method: 'POST',
      reauthToken: options?.reauthToken,
      useApiError: true,
    },
  );
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
  return requestAuthedJson<Payout>(
    `/admin/payments/payouts/${payoutId}/process`,
    accessToken,
    {
      method: 'POST',
      body: input ?? {},
      reauthToken: options?.reauthToken,
      useApiError: true,
    },
  );
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
  return requestAuthedJson<{
    jobId: string;
    paymentIntentId: string;
    releasedAmount: number;
    currency: string;
  }>(`/admin/payments/release/${jobId}`, accessToken, {
    method: 'POST',
    reauthToken: options?.reauthToken,
    useApiError: true,
  });
}
