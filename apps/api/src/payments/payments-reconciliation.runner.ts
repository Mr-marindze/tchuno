import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsReconciliationRunner
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentsReconciliationRunner.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly paymentsService: PaymentsService) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }

    const intervalMs = this.resolveIntervalMs();
    this.intervalRef = setInterval(() => {
      void this.runCycle();
    }, intervalMs);
    this.intervalRef.unref?.();

    this.logger.log(
      JSON.stringify({
        event: 'payments_auto_reconciliation_enabled',
        intervalMs,
      }),
    );

    void this.runCycle();
  }

  onModuleDestroy() {
    if (!this.intervalRef) {
      return;
    }

    clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  private async runCycle() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const summary =
        await this.paymentsService.reconcilePendingChargeTransactions({
          source: 'automatic',
        });

      if (summary.scanned > 0 || summary.errors.length > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'payments_auto_reconciliation_cycle',
            ...summary,
          }),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown_reconciliation_error';

      this.logger.error(
        JSON.stringify({
          event: 'payments_auto_reconciliation_failed',
          reason: message,
        }),
      );
    } finally {
      this.running = false;
    }
  }

  private isEnabled(): boolean {
    const raw = process.env.PAYMENT_AUTO_RECONCILIATION_ENABLED?.trim();
    if (!raw) {
      return process.env.NODE_ENV !== 'test';
    }

    return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
  }

  private resolveIntervalMs(): number {
    const parsed = Number(process.env.PAYMENT_AUTO_RECONCILIATION_INTERVAL_MS);
    if (!Number.isFinite(parsed)) {
      return 60_000;
    }

    return Math.min(3_600_000, Math.max(5_000, Math.trunc(parsed)));
  }
}
