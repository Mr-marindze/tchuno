import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { EmolaGatewayAdapter } from './gateway/emola-gateway.adapter';
import { InternalMockGatewayAdapter } from './gateway/internal-mock-gateway.adapter';
import { MpesaGatewayAdapter } from './gateway/mpesa-gateway.adapter';
import { PaymentGatewayAdapter } from './gateway/payment-gateway.adapter';

@Injectable()
export class PaymentGatewayRegistryService {
  private readonly logger = new Logger(PaymentGatewayRegistryService.name);
  private readonly warnedUnsupported = new Set<PaymentProvider>();

  constructor(
    private readonly internalMockGateway: InternalMockGatewayAdapter,
    private readonly mpesaGateway: MpesaGatewayAdapter,
    private readonly emolaGateway: EmolaGatewayAdapter,
  ) {}

  getAdapter(provider: PaymentProvider): PaymentGatewayAdapter {
    if (provider === PaymentProvider.INTERNAL) {
      return this.internalMockGateway;
    }

    if (provider === PaymentProvider.MPESA) {
      return this.mpesaGateway;
    }

    if (provider === PaymentProvider.EMOLA) {
      return this.emolaGateway;
    }

    if (!this.warnedUnsupported.has(provider)) {
      this.warnedUnsupported.add(provider);
      this.logger.warn(
        JSON.stringify({
          event: 'payment_gateway_provider_fallback_internal',
          provider,
        }),
      );
    }

    return this.internalMockGateway;
  }
}
