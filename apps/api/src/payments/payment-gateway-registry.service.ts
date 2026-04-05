import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { InternalMockGatewayAdapter } from './gateway/internal-mock-gateway.adapter';
import { PaymentGatewayAdapter } from './gateway/payment-gateway.adapter';

@Injectable()
export class PaymentGatewayRegistryService {
  constructor(
    private readonly internalMockGateway: InternalMockGatewayAdapter,
  ) {}

  getAdapter(provider: PaymentProvider): PaymentGatewayAdapter {
    if (provider === PaymentProvider.INTERNAL) {
      return this.internalMockGateway;
    }

    // Foundation mode: unsupported external gateways fallback to internal mock
    // to keep domain behavior testable before live integrations are enabled.
    return this.internalMockGateway;
  }
}
