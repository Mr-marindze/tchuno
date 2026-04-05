import { PaymentProvider } from '@prisma/client';

export type GatewayOperationStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVERSED';

export type GatewayChargeResult = {
  status: GatewayOperationStatus;
  providerReference: string;
  processedAt?: Date;
  rawPayload?: Record<string, unknown>;
  reason?: string | null;
};

export type GatewayRefundResult = {
  status: GatewayOperationStatus;
  providerReference: string;
  processedAt?: Date;
  rawPayload?: Record<string, unknown>;
  reason?: string | null;
};

export type GatewayPayoutResult = {
  status: GatewayOperationStatus;
  providerReference: string;
  processedAt?: Date;
  rawPayload?: Record<string, unknown>;
  reason?: string | null;
};

export type GatewayStatusResult = {
  status: GatewayOperationStatus;
  providerReference?: string;
  processedAt?: Date;
  rawPayload?: Record<string, unknown>;
  reason?: string | null;
};

export interface PaymentGatewayAdapter {
  readonly provider: PaymentProvider;
  requestCharge(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    customerId: string;
    jobId: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayChargeResult>;
  queryTransactionStatus(input: {
    providerReference: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayStatusResult>;
  requestRefund(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    providerReference?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayRefundResult>;
  requestPayout(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    providerUserId: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayPayoutResult>;
}
