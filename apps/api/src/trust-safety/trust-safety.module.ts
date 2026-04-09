import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminTrustSafetyController } from './admin-trust-safety.controller';
import { TrustSafetyController } from './trust-safety.controller';
import { TrustSafetyService } from './trust-safety.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TrustSafetyController, AdminTrustSafetyController],
  providers: [TrustSafetyService],
  exports: [TrustSafetyService],
})
export class TrustSafetyModule {}
