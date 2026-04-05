import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentPolicyService {
  private readonly platformFeeBps = this.resolveFeeBps();
  private readonly releaseDelayHours = this.resolveReleaseDelayHours();

  computeSplit(amount: number): {
    grossAmount: number;
    platformFeeAmount: number;
    providerNetAmount: number;
  } {
    const normalizedAmount = Math.max(0, Math.trunc(amount));
    const platformFeeAmount = Math.min(
      normalizedAmount,
      Math.round((normalizedAmount * this.platformFeeBps) / 10_000),
    );
    const providerNetAmount = Math.max(0, normalizedAmount - platformFeeAmount);

    return {
      grossAmount: normalizedAmount,
      platformFeeAmount,
      providerNetAmount,
    };
  }

  buildIntentExpiryDate(): Date {
    return new Date(Date.now() + 30 * 60 * 1000);
  }

  canReleaseFunds(input: { completedAt: Date | null; now?: Date }): boolean {
    if (!input.completedAt) {
      return false;
    }

    const now = input.now ?? new Date();
    const releaseAt = new Date(
      input.completedAt.getTime() + this.releaseDelayHours * 60 * 60 * 1000,
    );

    return now.getTime() >= releaseAt.getTime();
  }

  getReleaseDelayHours(): number {
    return this.releaseDelayHours;
  }

  private resolveFeeBps(): number {
    const raw = process.env.PAYMENT_PLATFORM_FEE_BPS;
    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
      return 1500;
    }

    return Math.min(9000, Math.max(0, Math.trunc(parsed)));
  }

  private resolveReleaseDelayHours(): number {
    const raw = process.env.PAYMENT_RELEASE_DELAY_HOURS;
    const parsed = Number(raw);

    if (!Number.isFinite(parsed)) {
      return 24;
    }

    return Math.max(0, Math.trunc(parsed));
  }
}
