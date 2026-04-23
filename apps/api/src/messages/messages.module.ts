import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrustSafetyModule } from '../trust-safety/trust-safety.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [NotificationsModule, TrustSafetyModule, RealtimeModule],
  controllers: [MessagesController],
  providers: [MessagesService, StorageService],
})
export class MessagesModule {}
