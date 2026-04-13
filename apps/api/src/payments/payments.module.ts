import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportOpsModule } from '../support-ops/support-ops.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { EmolaGatewayAdapter } from './gateway/emola-gateway.adapter';
import { InternalMockGatewayAdapter } from './gateway/internal-mock-gateway.adapter';
import { MpesaGatewayAdapter } from './gateway/mpesa-gateway.adapter';
import { LedgerService } from './ledger.service';
import { PaymentGatewayRegistryService } from './payment-gateway-registry.service';
import { PaymentPolicyService } from './payment-policy.service';
import { PaymentsController } from './payments.controller';
import { PaymentsReconciliationRunner } from './payments-reconciliation.runner';
import { PaymentsService } from './payments.service';

@Module({
  imports: [NotificationsModule, SupportOpsModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [
    PaymentsService,
    PaymentPolicyService,
    PaymentGatewayRegistryService,
    InternalMockGatewayAdapter,
    MpesaGatewayAdapter,
    EmolaGatewayAdapter,
    LedgerService,
    PaymentsReconciliationRunner,
  ],
})
export class PaymentsModule {}
