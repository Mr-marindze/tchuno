import { Module } from '@nestjs/common';
import { SupportOpsController } from './support-ops.controller';
import { SupportOpsService } from './support-ops.service';

@Module({
  controllers: [SupportOpsController],
  providers: [SupportOpsService],
  exports: [SupportOpsService],
})
export class SupportOpsModule {}
