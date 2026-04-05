import { Logger } from '@nestjs/common';
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

type StoredOperation = {
  status: GatewayOperationStatus;
  createdAtMs: number;
  reason?: string | null;
};

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

export abstract class SimulatedExternalGatewayAdapter implements PaymentGatewayAdapter {
  abstract readonly provider: PaymentProvider;
  private readonly logger = new Logger(SimulatedExternalGatewayAdapter.name);
  private readonly operations = new Map<string, StoredOperation>();

  requestCharge(input: {
    idempotencyKey: string;
    amount: number;
    currency: string;
    customerId: string;
    jobId: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayChargeResult> {
    const providerReference = this.createProviderReference('charge');
    const status = parseDesiredStatus(input.metadata) ?? 'PENDING';

    this.operations.set(providerReference, {
      status,
      createdAtMs: Date.now(),
      reason: status === 'FAILED' ? 'provider_charge_failed' : null,
    });

    return Promise.resolve({
      status,
      providerReference,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'provider_charge_failed' : null,
      rawPayload: {
        provider: this.provider,
        mode: 'simulated_external',
        operation: 'charge',
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
    const forcedStatus = parseDesiredStatus(input.metadata);
    if (forcedStatus) {
      return Promise.resolve({
        status: forcedStatus,
        providerReference: input.providerReference,
        processedAt: forcedStatus === 'PENDING' ? undefined : new Date(),
        reason: forcedStatus === 'FAILED' ? 'provider_forced_failed' : null,
        rawPayload: {
          provider: this.provider,
          mode: 'simulated_external',
          operation: 'status_query',
          forced: true,
        },
      });
    }

    const operation = this.operations.get(input.providerReference);
    if (!operation) {
      return Promise.resolve({
        status: 'PENDING',
        providerReference: input.providerReference,
        rawPayload: {
          provider: this.provider,
          mode: 'simulated_external',
          operation: 'status_query',
          knownReference: false,
        },
      });
    }

    if (operation.status === 'PENDING') {
      const elapsed = Date.now() - operation.createdAtMs;
      if (elapsed >= this.resolveSettlementDelayMs()) {
        operation.status = 'SUCCEEDED';
        operation.reason = null;
      }
    }

    this.operations.set(input.providerReference, operation);

    const isTerminal =
      operation.status === 'SUCCEEDED' ||
      operation.status === 'FAILED' ||
      operation.status === 'REVERSED';

    return Promise.resolve({
      status: operation.status,
      providerReference: input.providerReference,
      processedAt: isTerminal ? new Date() : undefined,
      reason: operation.status === 'FAILED' ? (operation.reason ?? null) : null,
      rawPayload: {
        provider: this.provider,
        mode: 'simulated_external',
        operation: 'status_query',
        knownReference: true,
        settlementDelayMs: this.resolveSettlementDelayMs(),
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
    const providerReference =
      input.providerReference ?? this.createProviderReference('refund');
    const status = parseDesiredStatus(input.metadata) ?? 'PENDING';

    this.operations.set(providerReference, {
      status,
      createdAtMs: Date.now(),
      reason: status === 'FAILED' ? 'provider_refund_failed' : null,
    });

    return Promise.resolve({
      status,
      providerReference,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'provider_refund_failed' : null,
      rawPayload: {
        provider: this.provider,
        mode: 'simulated_external',
        operation: 'refund',
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
    const providerReference = this.createProviderReference('payout');
    const status = parseDesiredStatus(input.metadata) ?? 'PENDING';

    this.operations.set(providerReference, {
      status,
      createdAtMs: Date.now(),
      reason: status === 'FAILED' ? 'provider_payout_failed' : null,
    });

    return Promise.resolve({
      status,
      providerReference,
      processedAt: status === 'PENDING' ? undefined : new Date(),
      reason: status === 'FAILED' ? 'provider_payout_failed' : null,
      rawPayload: {
        provider: this.provider,
        mode: 'simulated_external',
        operation: 'payout',
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
      },
    });
  }

  private resolveSettlementDelayMs() {
    const providerRaw =
      process.env[`PAYMENT_GATEWAY_${this.provider}_SETTLEMENT_DELAY_MS`];
    const fallbackRaw = process.env.PAYMENT_GATEWAY_SETTLEMENT_DELAY_MS;
    const parsed = Number(providerRaw ?? fallbackRaw);

    if (!Number.isFinite(parsed)) {
      return 30_000;
    }

    return Math.min(900_000, Math.max(3_000, Math.trunc(parsed)));
  }

  private createProviderReference(
    kind: 'charge' | 'refund' | 'payout',
  ): string {
    const normalizedProvider = this.provider.toLowerCase();
    const reference = `${normalizedProvider}-${kind}-${randomUUID()}`;
    this.logger.debug(
      JSON.stringify({
        event: 'simulated_external_reference_generated',
        provider: this.provider,
        kind,
        providerReference: reference,
      }),
    );
    return reference;
  }
}
