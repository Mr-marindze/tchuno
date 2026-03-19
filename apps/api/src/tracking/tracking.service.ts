import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  IngestTrackingEventsDto,
  TrackingEventItemDto,
} from './dto/ingest-tracking-events.dto';
import { ListTrackingWorkerRankingQueryDto } from './dto/list-tracking-worker-ranking-query.dto';

const MAX_INGEST_EVENTS = 200;
const MAX_IN_MEMORY_QUEUE = 3_000;
const MAX_RANKING_CANDIDATES = 600;
const RANKING_HALF_LIFE_HOURS = 48;

const CLICK_WEIGHT = 0.42;
const CTA_CLICK_WEIGHT = 0.58;
const CONVERSION_WEIGHT = 2.9;
const RATING_VALUE_WEIGHT = 1.65;
const RATING_COUNT_WEIGHT = 0.22;

type WorkerEventDelta = {
  interactions: number;
  clicks: number;
  ctaClicks: number;
  conversions: number;
  lastEventAt: Date | null;
};

type CategoryEventDelta = {
  interactions: number;
  lastEventAt: Date | null;
};

type TrackingEventRecord = {
  name: string;
  timestamp: string | null;
  metadata?: {
    workerId?: string;
    workerProfileId?: string;
    categorySlug?: string;
    source?: string;
  };
};

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly queue: TrackingEventRecord[] = [];
  private flushScheduled = false;
  private flushInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  ingestEvents(payload: IngestTrackingEventsDto) {
    const trimmedEvents = payload.events.slice(0, MAX_INGEST_EVENTS);

    let accepted = 0;
    let dropped = 0;

    for (const event of trimmedEvents) {
      if (this.queue.length >= MAX_IN_MEMORY_QUEUE) {
        dropped += 1;
        continue;
      }

      this.queue.push(this.toEventRecord(event));
      accepted += 1;
    }

    this.scheduleFlush();

    this.metrics.recordBusinessEvent({
      domain: 'tracking',
      event: 'events_ingested',
      result: dropped > 0 ? 'blocked' : 'success',
    });

    return {
      accepted,
      queued: this.queue.length,
      dropped,
    };
  }

  async listWorkerRanking(query: ListTrackingWorkerRankingQueryDto) {
    const { page, limit, skip } = resolvePagination(query);

    const aggregates = await this.prisma.trackingWorkerAggregate.findMany({
      orderBy: [
        { conversions: 'desc' },
        { ctaClicks: 'desc' },
        { clicks: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: MAX_RANKING_CANDIDATES,
    });

    if (aggregates.length === 0) {
      return buildPaginatedResponse({
        data: [],
        total: 0,
        page,
        limit,
      });
    }

    const profileIds = aggregates.map((item) => item.workerProfileId);

    const profiles = await this.prisma.workerProfile.findMany({
      where: {
        id: {
          in: profileIds,
        },
      },
      select: {
        id: true,
        isAvailable: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    const profileById = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    const includeUnavailable = query.includeUnavailable ?? false;

    const ranked = aggregates
      .map((aggregate) => {
        const profile = profileById.get(aggregate.workerProfileId);
        if (!profile) {
          return null;
        }

        if (!includeUnavailable && !profile.isAvailable) {
          return null;
        }

        const decayMultiplier = this.resolveDecayMultiplier(
          aggregate.lastEventAt ?? aggregate.updatedAt,
        );

        const ratingValue = this.parseRating(profile.ratingAvg);
        const qualityComponent =
          ratingValue * RATING_VALUE_WEIGHT +
          Math.log1p(Math.min(60, profile.ratingCount)) * RATING_COUNT_WEIGHT;

        const behaviorRaw =
          aggregate.clicks * CLICK_WEIGHT +
          aggregate.ctaClicks * CTA_CLICK_WEIGHT +
          aggregate.conversions * CONVERSION_WEIGHT;
        const behaviorComponent = behaviorRaw * decayMultiplier;

        const evidenceScore =
          Math.min(20, profile.ratingCount) +
          aggregate.interactions * 1.1 +
          aggregate.conversions * 4;
        const stabilityMultiplier =
          0.45 + this.clamp01(evidenceScore / 12) * 0.55;

        const confidenceGuardMultiplier =
          aggregate.interactions < 3 &&
          aggregate.conversions < 1 &&
          profile.ratingCount < 4
            ? 0.72
            : 1;

        const score =
          qualityComponent +
          behaviorComponent * stabilityMultiplier * confidenceGuardMultiplier;

        return {
          workerProfileId: aggregate.workerProfileId,
          score: Number(score.toFixed(3)),
          qualityComponent: Number(qualityComponent.toFixed(3)),
          behaviorComponent: Number(behaviorComponent.toFixed(3)),
          stabilityMultiplier: Number(
            (stabilityMultiplier * confidenceGuardMultiplier).toFixed(3),
          ),
          decayMultiplier: Number(decayMultiplier.toFixed(3)),
          interactions: aggregate.interactions,
          clicks: aggregate.clicks,
          ctaClicks: aggregate.ctaClicks,
          conversions: aggregate.conversions,
          ratingAvg: Number(ratingValue.toFixed(2)),
          ratingCount: profile.ratingCount,
          isAvailable: profile.isAvailable,
          lastEventAt: aggregate.lastEventAt?.toISOString() ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        const conversionDiff = b.conversions - a.conversions;
        if (conversionDiff !== 0) {
          return conversionDiff;
        }

        return b.ratingAvg - a.ratingAvg;
      });

    const pagedData = ranked.slice(skip, skip + limit);

    this.metrics.recordBusinessEvent({
      domain: 'tracking',
      event: 'ranking_read',
      result: 'success',
    });

    return buildPaginatedResponse({
      data: pagedData,
      total: ranked.length,
      page,
      limit,
    });
  }

  private toEventRecord(event: TrackingEventItemDto): TrackingEventRecord {
    return {
      name: event.name.trim(),
      timestamp: event.timestamp ?? null,
      metadata: event.metadata,
    };
  }

  private scheduleFlush() {
    if (this.flushScheduled) {
      return;
    }

    this.flushScheduled = true;
    setTimeout(() => {
      void this.flushQueue();
    }, 0);
  }

  private async flushQueue() {
    this.flushScheduled = false;

    if (this.flushInProgress) {
      this.scheduleFlush();
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.flushInProgress = true;

    const batch = this.queue.splice(0, this.queue.length);

    try {
      const workerDeltas = new Map<string, WorkerEventDelta>();
      const categoryDeltas = new Map<string, CategoryEventDelta>();

      for (const event of batch) {
        this.applyEventToAggregateMaps(event, workerDeltas, categoryDeltas);
      }

      await this.persistDeltas(workerDeltas, categoryDeltas);

      this.metrics.recordBusinessEvent({
        domain: 'tracking',
        event: 'events_flushed',
        result: 'success',
      });
    } catch (error) {
      this.logger.warn('Failed to flush tracking queue');
      this.logger.debug(String(error));
      this.metrics.recordBusinessEvent({
        domain: 'tracking',
        event: 'events_flushed',
        result: 'failed',
      });
    } finally {
      this.flushInProgress = false;

      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  private applyEventToAggregateMaps(
    event: TrackingEventRecord,
    workerDeltas: Map<string, WorkerEventDelta>,
    categoryDeltas: Map<string, CategoryEventDelta>,
  ) {
    const eventAt = this.resolveEventTimestamp(event.timestamp);

    if (
      event.name === 'marketplace.worker.card.click' ||
      event.name === 'dashboard.worker.card.click'
    ) {
      const workerProfileId = this.readWorkerProfileId(event.metadata);
      if (!workerProfileId) {
        return;
      }

      const next = this.getOrCreateWorkerDelta(workerDeltas, workerProfileId);
      next.interactions += 1;
      next.clicks += 1;
      next.lastEventAt = eventAt;
      return;
    }

    if (
      event.name === 'marketplace.cta.click' ||
      event.name === 'dashboard.cta.click'
    ) {
      const workerProfileId = this.readWorkerProfileId(event.metadata);
      if (!workerProfileId) {
        return;
      }

      const next = this.getOrCreateWorkerDelta(workerDeltas, workerProfileId);
      next.interactions += 1;
      next.ctaClicks += 1;
      next.lastEventAt = eventAt;
      return;
    }

    if (event.name === 'job.create.submit') {
      const workerProfileId = this.readWorkerProfileId(event.metadata);
      if (!workerProfileId) {
        return;
      }

      const next = this.getOrCreateWorkerDelta(workerDeltas, workerProfileId);
      next.interactions += 1;
      next.conversions += 1;
      next.lastEventAt = eventAt;
      return;
    }

    if (event.name === 'marketplace.category.select') {
      const categorySlug = this.readCategorySlug(event.metadata);
      if (!categorySlug) {
        return;
      }

      const next = this.getOrCreateCategoryDelta(categoryDeltas, categorySlug);
      next.interactions += 1;
      next.lastEventAt = eventAt;
    }
  }

  private async persistDeltas(
    workerDeltas: Map<string, WorkerEventDelta>,
    categoryDeltas: Map<string, CategoryEventDelta>,
  ) {
    if (workerDeltas.size === 0 && categoryDeltas.size === 0) {
      return;
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const [workerProfileId, delta] of workerDeltas) {
        await tx.trackingWorkerAggregate.upsert({
          where: {
            workerProfileId,
          },
          create: {
            workerProfileId,
            interactions: delta.interactions,
            clicks: delta.clicks,
            ctaClicks: delta.ctaClicks,
            conversions: delta.conversions,
            lastEventAt: delta.lastEventAt ?? now,
          },
          update: {
            interactions: {
              increment: delta.interactions,
            },
            clicks: {
              increment: delta.clicks,
            },
            ctaClicks: {
              increment: delta.ctaClicks,
            },
            conversions: {
              increment: delta.conversions,
            },
            lastEventAt: delta.lastEventAt ?? now,
          },
        });
      }

      for (const [categorySlug, delta] of categoryDeltas) {
        await tx.trackingCategoryAggregate.upsert({
          where: {
            categorySlug,
          },
          create: {
            categorySlug,
            interactions: delta.interactions,
            lastEventAt: delta.lastEventAt ?? now,
          },
          update: {
            interactions: {
              increment: delta.interactions,
            },
            lastEventAt: delta.lastEventAt ?? now,
          },
        });
      }
    });
  }

  private getOrCreateWorkerDelta(
    deltas: Map<string, WorkerEventDelta>,
    workerProfileId: string,
  ): WorkerEventDelta {
    const existing = deltas.get(workerProfileId);
    if (existing) {
      return existing;
    }

    const created: WorkerEventDelta = {
      interactions: 0,
      clicks: 0,
      ctaClicks: 0,
      conversions: 0,
      lastEventAt: null,
    };

    deltas.set(workerProfileId, created);
    return created;
  }

  private getOrCreateCategoryDelta(
    deltas: Map<string, CategoryEventDelta>,
    categorySlug: string,
  ): CategoryEventDelta {
    const existing = deltas.get(categorySlug);
    if (existing) {
      return existing;
    }

    const created: CategoryEventDelta = {
      interactions: 0,
      lastEventAt: null,
    };

    deltas.set(categorySlug, created);
    return created;
  }

  private readWorkerProfileId(
    metadata: TrackingEventRecord['metadata'] | undefined,
  ): string | null {
    const fromWorkerProfileId = this.normalizeWorkerProfileId(
      metadata?.workerProfileId,
    );

    if (fromWorkerProfileId) {
      return fromWorkerProfileId;
    }

    return this.normalizeWorkerProfileId(metadata?.workerId);
  }

  private readCategorySlug(
    metadata: TrackingEventRecord['metadata'] | undefined,
  ): string | null {
    const raw = metadata?.categorySlug;
    if (typeof raw !== 'string') {
      return null;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0 || normalized.length > 64) {
      return null;
    }

    return normalized;
  }

  private normalizeWorkerProfileId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > 64) {
      return null;
    }

    return normalized;
  }

  private resolveEventTimestamp(value: string | null): Date {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }

    return parsed;
  }

  private resolveDecayMultiplier(eventAt: Date): number {
    const ageMs = Math.max(0, Date.now() - eventAt.getTime());
    const halfLifeMs = RANKING_HALF_LIFE_HOURS * 60 * 60 * 1000;
    const halfLives = ageMs / halfLifeMs;
    const decay = Math.pow(0.5, halfLives);
    return Math.max(0.12, Math.min(1, decay));
  }

  private parseRating(value: Prisma.Decimal | number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.min(5, parsed));
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
