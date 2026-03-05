import { Module } from '@nestjs/common';
import { WorkerProfileController } from './worker-profile.controller';
import { WorkerProfileService } from './worker-profile.service';

@Module({
  controllers: [WorkerProfileController],
  providers: [WorkerProfileService],
})
export class WorkerProfileModule {}
