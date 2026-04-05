import { PaymentPolicyService } from './payment-policy.service';

describe('PaymentPolicyService', () => {
  const originalFeeBps = process.env.PAYMENT_PLATFORM_FEE_BPS;
  const originalReleaseDelay = process.env.PAYMENT_RELEASE_DELAY_HOURS;

  afterEach(() => {
    if (originalFeeBps === undefined) {
      delete process.env.PAYMENT_PLATFORM_FEE_BPS;
    } else {
      process.env.PAYMENT_PLATFORM_FEE_BPS = originalFeeBps;
    }

    if (originalReleaseDelay === undefined) {
      delete process.env.PAYMENT_RELEASE_DELAY_HOURS;
    } else {
      process.env.PAYMENT_RELEASE_DELAY_HOURS = originalReleaseDelay;
    }
  });

  it('computes split with default platform fee (15%)', () => {
    delete process.env.PAYMENT_PLATFORM_FEE_BPS;

    const service = new PaymentPolicyService();
    const split = service.computeSplit(10_000);

    expect(split).toEqual({
      grossAmount: 10_000,
      platformFeeAmount: 1_500,
      providerNetAmount: 8_500,
    });
  });

  it('applies rounding and keeps gross = fee + net', () => {
    process.env.PAYMENT_PLATFORM_FEE_BPS = '1700';

    const service = new PaymentPolicyService();
    const split = service.computeSplit(999);

    expect(split.platformFeeAmount).toBe(170);
    expect(split.providerNetAmount).toBe(829);
    expect(split.grossAmount).toBe(
      split.platformFeeAmount + split.providerNetAmount,
    );
  });

  it('clamps invalid and out-of-range fee configuration', () => {
    process.env.PAYMENT_PLATFORM_FEE_BPS = '99999';

    const high = new PaymentPolicyService().computeSplit(1_000);
    expect(high.platformFeeAmount).toBe(900);

    process.env.PAYMENT_PLATFORM_FEE_BPS = '-500';

    const low = new PaymentPolicyService().computeSplit(1_000);
    expect(low.platformFeeAmount).toBe(0);
  });

  it('enforces release delay based on completion time', () => {
    process.env.PAYMENT_RELEASE_DELAY_HOURS = '24';

    const service = new PaymentPolicyService();
    const completedAt = new Date('2026-01-01T00:00:00.000Z');

    expect(
      service.canReleaseFunds({
        completedAt,
        now: new Date('2026-01-01T23:59:59.000Z'),
      }),
    ).toBe(false);

    expect(
      service.canReleaseFunds({
        completedAt,
        now: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ).toBe(true);
  });
});
