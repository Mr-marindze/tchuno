import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  private readonly httpRequestDurationMs: Histogram<
    'method' | 'route' | 'status'
  >;

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

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
