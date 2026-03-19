import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import {
  IngestTrackingEventsDto,
  IngestTrackingEventsResponseDto,
} from './dto/ingest-tracking-events.dto';
import { ListTrackingWorkerRankingQueryDto } from './dto/list-tracking-worker-ranking-query.dto';
import { TrackingWorkerRankingListResponseDto } from './dto/tracking-worker-ranking-response.dto';
import { TrackingService } from './tracking.service';

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ingest frontend tracking events into shared aggregate queue',
  })
  @ApiCreatedResponse({ type: IngestTrackingEventsResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  ingest(@Body() payload: IngestTrackingEventsDto) {
    return this.trackingService.ingestEvents(payload);
  }

  @Get('ranking/workers')
  @ApiOperation({ summary: 'List shared worker ranking aggregates' })
  @ApiOkResponse({ type: TrackingWorkerRankingListResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  listWorkerRanking(@Query() query: ListTrackingWorkerRankingQueryDto) {
    return this.trackingService.listWorkerRanking(query);
  }
}
