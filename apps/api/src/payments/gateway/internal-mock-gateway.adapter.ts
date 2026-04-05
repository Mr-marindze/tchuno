import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  GatewayChargeResult,
  GatewayOperationStatus,
  GatewayPayoutResult,
  GatewayRefundResult,
  GatewayStatusResult,
  PaymentGatewayAdapter,
} from './payment-gateway.adapter';

function parseDesiredStatus(
  metadata?: Record<string, unknown>,
): GatewayOperationStatus | null {
  const simulate = metadata?.simulate;

  if (simulate === 'pending') {
    return 'PENDING';
  }

  if (simulate === 'failed') {
    return 'FAILED';
  }

  if (simulate === 'reversed') {
    return 'REVERSED';
  }

  if (simulate === 'success') {
    return 'SUCCEEDED';
  }

  return null;
}

@Injectable()
export class InternalMockGatewayAdapter implements PaymentGatewayAdapter {
  readonly provider = PaymentProvider.INTERNAL;

  requestCharge(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    customerId: string;
    jobId: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayChargeResult> {
    const status = parseDesiredStatus(input.metadata) ?? 'SUCCEEDED';
    const providerReference = `internal-charge-${randomUUID()}`;

    return Promise.resolve({
      status,
      providerReference,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'mock_charge_failed' : null,
      rawPayload: {
        kind: 'charge',
        mock: true,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
      },
    });
  }

  queryTransactionStatus(input: {
    providerReference: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayStatusResult> {
    const status = parseDesiredStatus(input.metadata) ?? 'SUCCEEDED';

    return Promise.resolve({
      status,
      providerReference: input.providerReference,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'mock_status_failed' : null,
      rawPayload: {
        kind: 'status_query',
        mock: true,
        providerReference: input.providerReference,
      },
    });
  }

  requestRefund(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    providerReference?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayRefundResult> {
    const status = parseDesiredStatus(input.metadata) ?? 'SUCCEEDED';

    return Promise.resolve({
      status,
      providerReference:
        input.providerReference ?? `internal-refund-${randomUUID()}`,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'mock_refund_failed' : null,
      rawPayload: {
        kind: 'refund',
        mock: true,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
      },
    });
  }

  requestPayout(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    providerUserId: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayPayoutResult> {
    const status = parseDesiredStatus(input.metadata) ?? 'SUCCEEDED';

    return Promise.resolve({
      status,
      providerReference: `internal-payout-${randomUUID()}`,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'mock_payout_failed' : null,
      rawPayload: {
        kind: 'payout',
        mock: true,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
      },
    });
  }
}
