import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

type BusinessDomain = 'auth' | 'jobs' | 'reviews' | 'tracking' | 'payments';
type BusinessResult = 'success' | 'failed' | 'blocked';
type JobStatusLabel =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  private readonly httpRequestDurationMs: Histogram<
    'method' | 'route' | 'status'
  >;
  private readonly businessEventsTotal: Counter<'domain' | 'event' | 'result'>;
  private readonly jobStatusTransitionsTotal: Counter<'from' | 'to' | 'result'>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({
      prefix: 'tchuno_api_',
      register: this.registry,
    });

    this.httpRequestsTotal = new Counter({
      name: 'tchuno_api_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'tchuno_api_http_request_duration_ms',
      help: 'Duration of HTTP requests in milliseconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    this.businessEventsTotal = new Counter({
      name: 'tchuno_api_business_events_total',
      help: 'Business domain events grouped by domain, event and result',
      labelNames: ['domain', 'event', 'result'],
      registers: [this.registry],
    });

    this.jobStatusTransitionsTotal = new Counter({
      name: 'tchuno_api_job_status_transitions_total',
      help: 'Job status transitions grouped by source/target status and result',
      labelNames: ['from', 'to', 'result'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(input: {
    method: string;
    route: string;
    status: number;
    durationMs: number;
  }) {
    const labels = {
      method: input.method,
      route: input.route,
      status: String(input.status),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, input.durationMs);
  }

  recordBusinessEvent(input: {
    domain: BusinessDomain;
    event: string;
    result?: BusinessResult;
  }) {
    this.businessEventsTotal.inc({
      domain: input.domain,
      event: this.sanitizeLabel(input.event),
      result: input.result ?? 'success',
    });
  }

  recordJobStatusTransition(input: {
    from: JobStatusLabel;
    to: JobStatusLabel;
    result?: 'success' | 'failed';
  }) {
    this.jobStatusTransitionsTotal.inc({
      from: input.from,
      to: input.to,
      result: input.result ?? 'success',
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  private sanitizeLabel(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 64);
  }
}
