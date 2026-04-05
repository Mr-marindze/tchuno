import { Module } from '@nestjs/common';
import { AdminPaymentsController } from './admin-payments.controller';
import { InternalMockGatewayAdapter } from './gateway/internal-mock-gateway.adapter';
import { LedgerService } from './ledger.service';
import { PaymentGatewayRegistryService } from './payment-gateway-registry.service';
import { PaymentPolicyService } from './payment-policy.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [
    PaymentsService,
    PaymentPolicyService,
    PaymentGatewayRegistryService,
    InternalMockGatewayAdapter,
    LedgerService,
  ],
})
export class PaymentsModule {}
