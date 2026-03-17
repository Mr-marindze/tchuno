import { Global, Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
