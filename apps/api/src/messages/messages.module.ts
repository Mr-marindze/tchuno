import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrustSafetyModule } from '../trust-safety/trust-safety.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [NotificationsModule, TrustSafetyModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
