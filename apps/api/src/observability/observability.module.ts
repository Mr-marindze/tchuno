import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [ObservabilityController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
