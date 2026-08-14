import {
  Controller,
  Get,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

@ApiTags('observability')
@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiOkResponse({ description: 'Prometheus text metrics' })
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.send(await this.metricsService.getMetrics());
  }

  @Get('health')
  @ApiOperation({ summary: 'Lightweight health endpoint' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness endpoint with database dependency check',
  })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        checks: { database: 'ok' },
        latencyMs: 3,
      },
    },
  })
  async ready() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        checks: {
          database: 'ok',
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          database: 'error',
        },
        latencyMs: Date.now() - startedAt,
      });
    }
  }
}
