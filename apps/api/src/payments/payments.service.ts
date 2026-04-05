import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerBalanceBucket,
  LedgerEntryType,
  PaymentIntentStatus,
  PaymentProvider,
  PaymentTransaction,
  Prisma,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole } from '../auth/authorization.types';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PayPaymentIntentDto } from './dto/pay-payment-intent.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { ReconcileTransactionDto } from './dto/reconcile-transaction.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentPolicyService } from './payment-policy.service';
import { PaymentGatewayRegistryService } from './payment-gateway-registry.service';
import { LedgerService } from './ledger.service';
import { GatewayOperationStatus } from './gateway/payment-gateway.adapter';

type ProviderSummary = {
  balances: {
    held: number;
    available: number;
    paidOut: number;
  };
  entries: Array<{
    id: string;
    entryType: LedgerEntryType;
    amount: number;
    direction: 'DEBIT' | 'CREDIT';
    bucket: LedgerBalanceBucket;
    createdAt: Date;
    paymentIntentId: string | null;
    jobId: string | null;
    description: string | null;
  }>;
  payouts: Array<{
    id: string;
    status: PayoutStatus;
    amount: number;
    currency: string;
    createdAt: Date;
    processedAt: Date | null;
    providerReference: string | null;
  }>;
};

type IntentActorInput = {
  userId: string;
  role?: AppRole;
};

const adminRoles = new Set<AppRole>([
  'admin',
  'support_admin',
  'ops_admin',
  'super_admin',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly paymentPolicyService: PaymentPolicyService,
    private readonly gatewayRegistry: PaymentGatewayRegistryService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createIntent(actorUserId: string, dto: CreatePaymentIntentDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      include: {
        workerProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.clientId !== actorUserId) {
      throw new ForbiddenException(
        'Only the job client can create payment intent',
      );
    }

    if (!job.requestId || !job.proposalId) {
      throw new ConflictException(
        'Legacy direct jobs are not eligible. Payment intents are only supported for jobs created from selected proposals.',
      );
    }

    const chargeAmount = this.resolveChargeAmount({
      budget: job.budget,
      agreedPrice: job.agreedPrice,
    });

    const existingIntent = await this.prisma.paymentIntent.findFirst({
      where: {
        jobId: job.id,
        status: {
          in: [
            'AWAITING_PAYMENT',
            'PENDING_CONFIRMATION',
            'PAID_PARTIAL',
            'SUCCEEDED',
          ],
        },
      },
      include: {
        transactions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    if (existingIntent) {
      return existingIntent;
    }

    const provider = dto.provider ?? PaymentProvider.INTERNAL;
    const split = this.paymentPolicyService.computeSplit(chargeAmount);

    const intent = await this.prisma.paymentIntent.create({
      data: {
        jobId: job.id,
        customerId: actorUserId,
        providerUserId: job.providerId ?? job.workerProfile.userId,
        amount: split.grossAmount,
        currency: 'MZN',
        platformFeeAmount: split.platformFeeAmount,
        providerNetAmount: split.providerNetAmount,
        status: 'AWAITING_PAYMENT',
        provider,
        expiresAt: this.paymentPolicyService.buildIntentExpiryDate(),
        acceptedQuoteSnapshot: job.agreedPrice,
        metadata: {
          pricingMode: job.pricingMode,
          flow: 'service_request',
        } satisfies Prisma.JsonObject,
      },
      include: {
        transactions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'payments',
      event: 'payment_intent_created',
      result: 'success',
    });

    this.logger.log(
      JSON.stringify({
        event: 'payment_intent_created',
        paymentIntentId: intent.id,
        jobId: intent.jobId,
        customerId: intent.customerId,
        provider: intent.provider,
      }),
    );

    return intent;
  }

  async payIntent(
    intentId: string,
    actorUserId: string,
    dto?: PayPaymentIntentDto,
  ) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: {
        transactions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });

    if (!intent) {
      throw new NotFoundException('Payment intent not found');
    }

    if (intent.customerId !== actorUserId) {
      throw new ForbiddenException('Only the customer can pay this intent');
    }

    if (intent.status === 'PAID_PARTIAL' || intent.status === 'SUCCEEDED') {
      return intent;
    }

    if (
      !['AWAITING_PAYMENT', 'PENDING_CONFIRMATION', 'FAILED'].includes(
        intent.status,
      )
    ) {
      throw new ConflictException(
        'Payment intent is not payable in current state',
      );
    }

    const idempotencyKey =
      dto?.idempotencyKey?.trim() || `charge-${intent.id}-${Date.now()}`;
    if (dto?.idempotencyKey) {
      const existingTransaction =
        await this.prisma.paymentTransaction.findUnique({
          where: { idempotencyKey },
        });

      if (existingTransaction?.paymentIntentId === intent.id) {
        return this.prisma.paymentIntent.findUniqueOrThrow({
          where: { id: intent.id },
          include: {
            transactions: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            },
          },
        });
      }
    }

    const gateway = this.gatewayRegistry.getAdapter(intent.provider);
    const gatewayResult = await gateway.requestCharge({
      idempotencyKey,
      amount: intent.amount,
      currency: intent.currency,
      customerId: intent.customerId,
      jobId: intent.jobId,
      metadata: {
        paymentIntentId: intent.id,
        ...(dto?.simulate ? { simulate: dto.simulate } : {}),
      },
    });

    await this.prisma.$transaction(async (tx) => {
      const transactionStatus = this.mapGatewayToTransactionStatus(
        gatewayResult.status,
      );

      const transaction = await tx.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          type: 'CHARGE',
          status: transactionStatus,
          provider: intent.provider,
          providerReference: gatewayResult.providerReference,
          idempotencyKey,
          requestedAmount: intent.amount,
          confirmedAmount:
            transactionStatus === 'SUCCEEDED' ? intent.amount : null,
          currency: intent.currency,
          providerPayload:
            (gatewayResult.rawPayload as Prisma.InputJsonValue | undefined) ??
            undefined,
          failureReason: gatewayResult.reason ?? null,
          processedAt: gatewayResult.processedAt,
        },
      });

      return this.applyGatewayStatus(tx, {
        transaction,
        gatewayStatus: gatewayResult.status,
        rawPayload: gatewayResult.rawPayload ?? undefined,
        reason: gatewayResult.reason,
      });
    });

    return this.prisma.paymentIntent.findUniqueOrThrow({
      where: { id: intent.id },
      include: {
        transactions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
  }

  async listMyCustomerIntents(
    actorUserId: string,
    query: ListPaymentsQueryDto,
  ) {
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.PaymentIntentWhereInput = {
      customerId: actorUserId,
      ...(query.status
        ? {
            status: query.status as PaymentIntentStatus,
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.paymentIntent.count({ where }),
      this.prisma.paymentIntent.findMany({
        where,
        include: {
          transactions: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async getIntentById(intentId: string, actor: IntentActorInput) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: {
        transactions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
        job: {
          select: {
            id: true,
            clientId: true,
            workerProfile: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!intent) {
      throw new NotFoundException('Payment intent not found');
    }

    this.assertIntentAccess(intent, actor);

    return intent;
  }

  async getJobFinancialState(jobId: string, actor: IntentActorInput) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        workerProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const canAccess =
      adminRoles.has(actor.role ?? 'customer') ||
      job.clientId === actor.userId ||
      job.workerProfile.userId === actor.userId;

    if (!canAccess) {
      throw new ForbiddenException('You are not allowed to access this job');
    }

    const intents = await this.prisma.paymentIntent.findMany({
      where: {
        jobId,
      },
      include: {
        transactions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const latestIntent = intents[0] ?? null;

    return {
      jobId,
      jobStatus: job.status,
      paymentState: latestIntent?.status ?? 'NOT_REQUIRED',
      intents,
    };
  }

  async getProviderSummary(actorUserId: string): Promise<ProviderSummary> {
    const held = await this.ledgerService.computeBucketNet(this.prisma, {
      bucket: 'PROVIDER_HELD',
      where: {
        actorType: 'PROVIDER',
        paymentIntent: {
          providerUserId: actorUserId,
        },
      },
    });

    const available = await this.ledgerService.computeBucketNet(this.prisma, {
      bucket: 'PROVIDER_AVAILABLE',
      where: {
        actorType: 'PROVIDER',
        paymentIntent: {
          providerUserId: actorUserId,
        },
      },
    });

    const paidOut = await this.ledgerService.computeBucketNet(this.prisma, {
      bucket: 'PROVIDER_PAID_OUT',
      where: {
        actorType: 'PROVIDER',
        paymentIntent: {
          providerUserId: actorUserId,
        },
      },
    });

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        actorType: 'PROVIDER',
        paymentIntent: {
          providerUserId: actorUserId,
        },
      },
      select: {
        id: true,
        entryType: true,
        amount: true,
        direction: true,
        balanceBucket: true,
        createdAt: true,
        description: true,
        paymentIntentId: true,
        jobId: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });

    const payouts = await this.prisma.payout.findMany({
      where: {
        providerUserId: actorUserId,
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
        processedAt: true,
        providerReference: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });

    return {
      balances: {
        held,
        available,
        paidOut,
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        amount: entry.amount,
        direction: entry.direction,
        bucket: entry.balanceBucket,
        createdAt: entry.createdAt,
        paymentIntentId: entry.paymentIntentId,
        jobId: entry.jobId,
        description: entry.description,
      })),
      payouts,
    };
  }

  async handleWebhook(provider: PaymentProvider, dto: PaymentWebhookDto) {
    if (dto.externalEventId) {
      const existing = await this.prisma.paymentEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider,
            externalEventId: dto.externalEventId,
          },
        },
      });

      if (existing) {
        return {
          accepted: true,
          deduplicated: true,
          eventId: existing.id,
        };
      }
    }

    const event = await this.prisma.paymentEvent.create({
      data: {
        provider,
        eventType: dto.status ?? 'provider.webhook',
        externalEventId: dto.externalEventId,
        providerReference: dto.providerReference,
        payload: (dto.payload as Prisma.InputJsonValue | undefined) ?? {},
        signatureValid: dto.signatureValid ?? false,
      },
    });

    let transaction = null as PaymentTransaction | null;

    if (dto.transactionId) {
      transaction = await this.prisma.paymentTransaction.findUnique({
        where: { id: dto.transactionId },
      });
    }

    if (!transaction && dto.providerReference) {
      transaction = await this.prisma.paymentTransaction.findFirst({
        where: {
          provider,
          providerReference: dto.providerReference,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    }

    if (!transaction || !dto.status) {
      await this.prisma.paymentEvent.update({
        where: { id: event.id },
        data: {
          processed: false,
          processedAt: new Date(),
          transactionId: transaction?.id,
          paymentIntentId: transaction?.paymentIntentId,
        },
      });

      return {
        accepted: true,
        processed: false,
        eventId: event.id,
      };
    }

    const status = dto.status;
    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      const transactionRecord = await tx.paymentTransaction.findUnique({
        where: { id: transaction.id },
      });

      if (!transactionRecord) {
        throw new NotFoundException('Payment transaction not found');
      }

      return this.applyGatewayStatus(tx, {
        transaction: transactionRecord,
        gatewayStatus: this.parseGatewayStatus(status),
        rawPayload: dto.payload,
      });
    });

    await this.prisma.paymentEvent.update({
      where: { id: event.id },
      data: {
        processed: true,
        processedAt: new Date(),
        transactionId: updatedTransaction.id,
        paymentIntentId: updatedTransaction.paymentIntentId,
      },
    });

    return {
      accepted: true,
      processed: true,
      eventId: event.id,
      transactionId: updatedTransaction.id,
    };
  }

  async reconcileTransaction(
    transactionId: string,
    dto?: ReconcileTransactionDto,
  ) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    const gateway = this.gatewayRegistry.getAdapter(transaction.provider);
    const gatewayResult = await gateway.queryTransactionStatus({
      providerReference: transaction.providerReference ?? transaction.id,
      metadata: {
        simulate: dto?.simulate,
      },
    });

    return this.prisma.$transaction((tx) =>
      this.applyGatewayStatus(tx, {
        transaction,
        gatewayStatus: gatewayResult.status,
        rawPayload: gatewayResult.rawPayload,
        reason: gatewayResult.reason,
      }),
    );
  }

  async adminOverview() {
    const [
      totalIntents,
      intentsAwaitingPayment,
      intentsSucceeded,
      intentsFailed,
      totalTransactions,
      failedTransactions,
      pendingRefunds,
      pendingPayouts,
    ] = await this.prisma.$transaction([
      this.prisma.paymentIntent.count(),
      this.prisma.paymentIntent.count({
        where: {
          status: {
            in: ['CREATED', 'AWAITING_PAYMENT', 'PENDING_CONFIRMATION'],
          },
        },
      }),
      this.prisma.paymentIntent.count({
        where: {
          status: {
            in: ['PAID_PARTIAL', 'SUCCEEDED'],
          },
        },
      }),
      this.prisma.paymentIntent.count({
        where: {
          status: 'FAILED',
        },
      }),
      this.prisma.paymentTransaction.count(),
      this.prisma.paymentTransaction.count({
        where: {
          status: 'FAILED',
        },
      }),
      this.prisma.refundRequest.count({
        where: {
          status: {
            in: ['PENDING', 'APPROVED', 'PROCESSING'],
          },
        },
      }),
      this.prisma.payout.count({
        where: {
          status: {
            in: ['PENDING', 'APPROVED', 'PROCESSING'],
          },
        },
      }),
    ]);

    const platformReserved = await this.ledgerService.computeBucketNet(
      this.prisma,
      {
        bucket: 'PLATFORM_RESERVED',
        where: {
          actorType: 'PLATFORM',
        },
      },
    );

    const providerHeld = await this.ledgerService.computeBucketNet(
      this.prisma,
      {
        bucket: 'PROVIDER_HELD',
        where: {
          actorType: 'PROVIDER',
        },
      },
    );

    const providerAvailable = await this.ledgerService.computeBucketNet(
      this.prisma,
      {
        bucket: 'PROVIDER_AVAILABLE',
        where: {
          actorType: 'PROVIDER',
        },
      },
    );

    return {
      kpis: {
        totalIntents,
        intentsAwaitingPayment,
        intentsSucceeded,
        intentsFailed,
        totalTransactions,
        failedTransactions,
        pendingRefunds,
        pendingPayouts,
        platformReserved,
        providerHeld,
        providerAvailable,
        releaseDelayHours: this.paymentPolicyService.getReleaseDelayHours(),
      },
    };
  }

  async adminListIntents(query: ListPaymentsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.PaymentIntentWhereInput = {
      ...(query.status
        ? {
            status: query.status as PaymentIntentStatus,
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.paymentIntent.count({ where }),
      this.prisma.paymentIntent.findMany({
        where,
        include: {
          transactions: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async adminListTransactions(query: ListPaymentsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.PaymentTransactionWhereInput = {
      ...(query.status
        ? {
            status: query.status as TransactionStatus,
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.count({ where }),
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async adminListRefunds(query: ListPaymentsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.RefundRequestWhereInput = {
      ...(query.status
        ? {
            status: query.status as RefundStatus,
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.refundRequest.count({ where }),
      this.prisma.refundRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async adminCreateRefund(actorUserId: string, dto: CreateRefundRequestDto) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: dto.paymentIntentId },
    });

    if (!intent) {
      throw new NotFoundException('Payment intent not found');
    }

    if (!['PAID_PARTIAL', 'SUCCEEDED'].includes(intent.status)) {
      throw new ConflictException('Only paid payment intents can be refunded');
    }

    const successfulRefunds = await this.prisma.refundRequest.aggregate({
      where: {
        paymentIntentId: intent.id,
        status: {
          in: ['SUCCEEDED'],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyRefunded = successfulRefunds._sum?.amount ?? 0;
    const remainingRefundable = intent.amount - alreadyRefunded;

    if (remainingRefundable <= 0) {
      throw new ConflictException(
        'This payment has no refundable balance left',
      );
    }

    const amount = dto.amount ?? remainingRefundable;
    if (amount > remainingRefundable) {
      throw new BadRequestException('Refund amount exceeds refundable balance');
    }

    const platformPart =
      intent.amount === 0
        ? 0
        : Math.round((amount * intent.platformFeeAmount) / intent.amount);
    const providerPart = amount - platformPart;

    return this.prisma.$transaction(async (tx) => {
      const refundRequest = await tx.refundRequest.create({
        data: {
          jobId: intent.jobId,
          paymentIntentId: intent.id,
          requestedByUserId: actorUserId,
          approvedByUserId: actorUserId,
          amount,
          currency: intent.currency,
          reason: dto.reason.trim(),
          status: 'APPROVED',
          provider: intent.provider,
        },
      });

      const gateway = this.gatewayRegistry.getAdapter(intent.provider);
      const gatewayResult = await gateway.requestRefund({
        idempotencyKey: `refund-${refundRequest.id}`,
        amount,
        currency: intent.currency,
        providerReference: null,
      });

      const transactionStatus = this.mapGatewayToTransactionStatus(
        gatewayResult.status,
      );

      const transaction = await tx.paymentTransaction.create({
        data: {
          paymentIntentId: intent.id,
          type: 'REFUND',
          status: transactionStatus,
          provider: intent.provider,
          providerReference: gatewayResult.providerReference,
          idempotencyKey: `refund-${refundRequest.id}`,
          requestedAmount: amount,
          confirmedAmount: transactionStatus === 'SUCCEEDED' ? amount : null,
          currency: intent.currency,
          providerPayload:
            (gatewayResult.rawPayload as Prisma.InputJsonValue | undefined) ??
            undefined,
          failureReason: gatewayResult.reason ?? null,
          processedAt: gatewayResult.processedAt,
        },
      });

      const nextRefundStatus =
        transactionStatus === 'SUCCEEDED'
          ? 'SUCCEEDED'
          : transactionStatus === 'FAILED'
            ? 'FAILED'
            : 'PROCESSING';

      await tx.refundRequest.update({
        where: {
          id: refundRequest.id,
        },
        data: {
          status: nextRefundStatus,
          transactionId: transaction.id,
          providerReference: transaction.providerReference,
          processedAt: transaction.processedAt,
          failureReason: transaction.failureReason,
        },
      });

      if (transaction.status === 'SUCCEEDED') {
        await this.appendRefundLedgerEntries(tx, {
          intent,
          transactionId: transaction.id,
          amount,
          platformPart,
          providerPart,
          actorUserId,
        });
      }

      return tx.refundRequest.findUniqueOrThrow({
        where: { id: refundRequest.id },
      });
    });
  }

  async adminCreatePayout(actorUserId: string, dto: CreatePayoutDto) {
    if (!dto.paymentIntentId) {
      throw new BadRequestException('paymentIntentId is required for payout');
    }

    const intent = await this.prisma.paymentIntent.findUnique({
      where: {
        id: dto.paymentIntentId,
      },
    });

    if (!intent) {
      throw new NotFoundException('Payment intent not found');
    }

    if (intent.providerUserId !== dto.providerUserId) {
      throw new BadRequestException(
        'providerUserId does not match payment intent owner',
      );
    }

    const availableForIntent = await this.ledgerService.computeBucketNet(
      this.prisma,
      {
        bucket: 'PROVIDER_AVAILABLE',
        where: {
          actorType: 'PROVIDER',
          paymentIntentId: intent.id,
        },
      },
    );

    const reservedByPendingPayout = await this.prisma.payout.aggregate({
      where: {
        paymentIntentId: intent.id,
        status: {
          in: ['PENDING', 'APPROVED', 'PROCESSING'],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const availableNet =
      availableForIntent - (reservedByPendingPayout._sum.amount ?? 0);

    if (dto.amount > availableNet) {
      throw new ConflictException('Payout amount exceeds available balance');
    }

    return this.prisma.payout.create({
      data: {
        providerUserId: dto.providerUserId,
        jobId: dto.jobId ?? intent.jobId,
        paymentIntentId: intent.id,
        amount: dto.amount,
        currency: dto.currency?.trim() || intent.currency,
        status: 'PENDING',
        provider: dto.provider ?? intent.provider,
        requestedByUserId: actorUserId,
      },
    });
  }

  async adminApprovePayout(actorUserId: string, payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: {
        id: payoutId,
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new ConflictException('Only pending payouts can be approved');
    }

    return this.prisma.payout.update({
      where: {
        id: payout.id,
      },
      data: {
        status: 'APPROVED',
        approvedByUserId: actorUserId,
      },
    });
  }

  async adminProcessPayout(
    actorUserId: string,
    payoutId: string,
    dto?: ProcessPayoutDto,
  ) {
    const payout = await this.prisma.payout.findUnique({
      where: {
        id: payoutId,
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (!['PENDING', 'APPROVED', 'PROCESSING'].includes(payout.status)) {
      throw new ConflictException(
        'Payout cannot be processed in current status',
      );
    }

    const gateway = this.gatewayRegistry.getAdapter(payout.provider);
    const gatewayResult = await gateway.requestPayout({
      idempotencyKey: `payout-${payout.id}`,
      amount: payout.amount,
      currency: payout.currency,
      providerUserId: payout.providerUserId,
      metadata: {
        simulate: dto?.simulate,
      },
    });

    const transactionStatus = this.mapGatewayToTransactionStatus(
      gatewayResult.status,
    );

    return this.prisma.$transaction(async (tx) => {
      const payoutRecord = await tx.payout.findUnique({
        where: {
          id: payout.id,
        },
      });

      if (!payoutRecord) {
        throw new NotFoundException('Payout not found');
      }

      const transaction = await tx.paymentTransaction.create({
        data: {
          paymentIntentId: payoutRecord.paymentIntentId,
          type: 'PAYOUT',
          status: transactionStatus,
          provider: payoutRecord.provider,
          providerReference:
            dto?.providerReference?.trim() || gatewayResult.providerReference,
          idempotencyKey: `payout-${payoutRecord.id}-${randomUUID()}`,
          requestedAmount: payoutRecord.amount,
          confirmedAmount:
            transactionStatus === 'SUCCEEDED' ? payoutRecord.amount : null,
          currency: payoutRecord.currency,
          providerPayload:
            (gatewayResult.rawPayload as Prisma.InputJsonValue | undefined) ??
            undefined,
          failureReason: gatewayResult.reason ?? null,
          processedAt: gatewayResult.processedAt,
        },
      });

      const nextPayoutStatus: PayoutStatus =
        transactionStatus === 'SUCCEEDED'
          ? 'PAID'
          : transactionStatus === 'FAILED'
            ? 'FAILED'
            : 'PROCESSING';

      const updatedPayout = await tx.payout.update({
        where: {
          id: payoutRecord.id,
        },
        data: {
          status: nextPayoutStatus,
          approvedByUserId: payoutRecord.approvedByUserId ?? actorUserId,
          processedAt: transaction.processedAt,
          providerReference: transaction.providerReference,
          failureReason: transaction.failureReason,
        },
      });

      if (nextPayoutStatus === 'PAID') {
        const availableBalance = await this.ledgerService.computeBucketNet(tx, {
          bucket: 'PROVIDER_AVAILABLE',
          where: {
            actorType: 'PROVIDER',
            paymentIntentId: payoutRecord.paymentIntentId,
          },
        });

        if (updatedPayout.amount > availableBalance) {
          throw new ConflictException(
            'Payout amount exceeds currently available provider balance',
          );
        }

        await this.ledgerService.appendEntries(tx, [
          {
            jobId: updatedPayout.jobId,
            paymentIntentId: updatedPayout.paymentIntentId,
            transactionId: transaction.id,
            actorType: 'PROVIDER',
            entryType: 'PROVIDER_PAYOUT',
            amount: updatedPayout.amount,
            currency: updatedPayout.currency,
            direction: 'DEBIT',
            balanceBucket: 'PROVIDER_AVAILABLE',
            description: 'Provider payout settled',
            createdByUserId: actorUserId,
          },
          {
            jobId: updatedPayout.jobId,
            paymentIntentId: updatedPayout.paymentIntentId,
            transactionId: transaction.id,
            actorType: 'PROVIDER',
            entryType: 'PROVIDER_PAYOUT',
            amount: updatedPayout.amount,
            currency: updatedPayout.currency,
            direction: 'CREDIT',
            balanceBucket: 'PROVIDER_PAID_OUT',
            description: 'Provider payout accounted as paid out',
            createdByUserId: actorUserId,
          },
        ]);
      }

      return updatedPayout;
    });
  }

  async adminReleaseProviderFunds(actorUserId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'COMPLETED') {
      throw new ConflictException(
        'Only completed jobs can release provider funds',
      );
    }

    if (
      !this.paymentPolicyService.canReleaseFunds({
        completedAt: job.completedAt,
      })
    ) {
      throw new ConflictException(
        `Release window not reached yet (${this.paymentPolicyService.getReleaseDelayHours()}h)`,
      );
    }

    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        jobId: job.id,
        status: {
          in: ['PAID_PARTIAL', 'SUCCEEDED'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    if (!intent) {
      throw new NotFoundException(
        'No successful payment intent found for this job',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const heldBalance = await this.ledgerService.computeBucketNet(tx, {
        bucket: 'PROVIDER_HELD',
        where: {
          actorType: 'PROVIDER',
          paymentIntentId: intent.id,
        },
      });

      if (heldBalance <= 0) {
        throw new ConflictException(
          'No held provider balance available to release',
        );
      }

      await this.ledgerService.appendEntries(tx, [
        {
          jobId: intent.jobId,
          paymentIntentId: intent.id,
          actorType: 'PROVIDER',
          entryType: 'PROVIDER_BALANCE_RELEASED',
          amount: heldBalance,
          currency: intent.currency,
          direction: 'DEBIT',
          balanceBucket: 'PROVIDER_HELD',
          description: 'Provider held balance released after completion window',
          createdByUserId: actorUserId,
        },
        {
          jobId: intent.jobId,
          paymentIntentId: intent.id,
          actorType: 'PROVIDER',
          entryType: 'PROVIDER_BALANCE_RELEASED',
          amount: heldBalance,
          currency: intent.currency,
          direction: 'CREDIT',
          balanceBucket: 'PROVIDER_AVAILABLE',
          description: 'Provider funds now available for payout',
          createdByUserId: actorUserId,
        },
      ]);

      return {
        jobId: intent.jobId,
        paymentIntentId: intent.id,
        releasedAmount: heldBalance,
        currency: intent.currency,
      };
    });
  }

  private assertIntentAccess(
    intent: {
      customerId: string;
      providerUserId: string | null;
    },
    actor: IntentActorInput,
  ) {
    const isAdmin = adminRoles.has(actor.role ?? 'customer');
    const isCustomer = intent.customerId === actor.userId;
    const isProvider = intent.providerUserId === actor.userId;

    if (!isAdmin && !isCustomer && !isProvider) {
      throw new ForbiddenException(
        'You are not allowed to access this payment',
      );
    }
  }

  private resolveChargeAmount(input: {
    budget: number | null;
    agreedPrice: number | null;
  }): number {
    if (input.agreedPrice && input.agreedPrice > 0) {
      return input.agreedPrice;
    }

    if (input.budget && input.budget > 0) {
      return input.budget;
    }

    throw new ConflictException(
      'Jobs created from selected proposals must keep agreedPrice snapshot before payment intent creation',
    );
  }

  private mapGatewayToTransactionStatus(
    status: GatewayOperationStatus,
  ): TransactionStatus {
    if (status === 'SUCCEEDED') {
      return 'SUCCEEDED';
    }

    if (status === 'FAILED') {
      return 'FAILED';
    }

    if (status === 'REVERSED') {
      return 'REVERSED';
    }

    return 'PROCESSING';
  }

  private mapGatewayToIntentStatus(
    status: GatewayOperationStatus,
    input?: {
      metadata?: Prisma.JsonValue | null;
    },
  ): PaymentIntentStatus {
    if (status === 'SUCCEEDED') {
      return this.isDepositIntent(input?.metadata)
        ? 'PAID_PARTIAL'
        : 'SUCCEEDED';
    }

    if (status === 'FAILED') {
      return 'FAILED';
    }

    return 'PENDING_CONFIRMATION';
  }

  private parseGatewayStatus(status: string): GatewayOperationStatus {
    const normalized = status.trim().toUpperCase();

    if (normalized === 'SUCCEEDED' || normalized === 'SUCCESS') {
      return 'SUCCEEDED';
    }

    if (normalized === 'FAILED' || normalized === 'FAILURE') {
      return 'FAILED';
    }

    if (normalized === 'REVERSED') {
      return 'REVERSED';
    }

    return 'PENDING';
  }

  private isDepositIntent(metadata?: Prisma.JsonValue | null): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }

    const record = metadata as Record<string, unknown>;
    return record.kind === 'deposit';
  }

  private async ensureChargeLedgerEntries(
    prisma: Prisma.TransactionClient,
    input: {
      paymentIntentId: string;
      transactionId: string;
      jobId: string;
      amount: number;
      platformFeeAmount: number;
      providerNetAmount: number;
    },
  ) {
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        transactionId: input.transactionId,
        entryType: 'CUSTOMER_CHARGE',
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return;
    }

    await this.ledgerService.appendEntries(prisma, [
      {
        jobId: input.jobId,
        paymentIntentId: input.paymentIntentId,
        transactionId: input.transactionId,
        actorType: 'CUSTOMER',
        entryType: 'CUSTOMER_CHARGE',
        amount: input.amount,
        currency: 'MZN',
        direction: 'DEBIT',
        balanceBucket: 'CUSTOMER_EXTERNAL',
        description: 'Customer charge confirmed',
      },
      {
        jobId: input.jobId,
        paymentIntentId: input.paymentIntentId,
        transactionId: input.transactionId,
        actorType: 'PLATFORM',
        entryType: 'PLATFORM_FEE_RESERVED',
        amount: input.platformFeeAmount,
        currency: 'MZN',
        direction: 'CREDIT',
        balanceBucket: 'PLATFORM_RESERVED',
        description: 'Platform fee reserved from customer charge',
      },
      {
        jobId: input.jobId,
        paymentIntentId: input.paymentIntentId,
        transactionId: input.transactionId,
        actorType: 'PROVIDER',
        entryType: 'PROVIDER_BALANCE_HELD',
        amount: input.providerNetAmount,
        currency: 'MZN',
        direction: 'CREDIT',
        balanceBucket: 'PROVIDER_HELD',
        description: 'Provider net amount moved to held balance',
      },
    ]);
  }

  private async appendRefundLedgerEntries(
    prisma: Prisma.TransactionClient,
    input: {
      intent: {
        id: string;
        jobId: string;
        currency: string;
      };
      transactionId: string;
      amount: number;
      platformPart: number;
      providerPart: number;
      actorUserId: string;
    },
  ) {
    const platformReserved = await this.ledgerService.computeBucketNet(prisma, {
      bucket: 'PLATFORM_RESERVED',
      where: {
        actorType: 'PLATFORM',
        paymentIntentId: input.intent.id,
      },
    });

    if (input.platformPart > platformReserved) {
      throw new ConflictException(
        'Insufficient platform reserved balance for refund settlement',
      );
    }

    const providerHeld = await this.ledgerService.computeBucketNet(prisma, {
      bucket: 'PROVIDER_HELD',
      where: {
        actorType: 'PROVIDER',
        paymentIntentId: input.intent.id,
      },
    });

    const providerAvailable = await this.ledgerService.computeBucketNet(
      prisma,
      {
        bucket: 'PROVIDER_AVAILABLE',
        where: {
          actorType: 'PROVIDER',
          paymentIntentId: input.intent.id,
        },
      },
    );

    const providerFunds = providerHeld + providerAvailable;
    if (input.providerPart > providerFunds) {
      throw new ConflictException('Insufficient provider balance for refund');
    }

    const heldDebit = Math.min(providerHeld, input.providerPart);
    const availableDebit = input.providerPart - heldDebit;

    const entries: Prisma.LedgerEntryCreateManyInput[] = [];

    if (input.platformPart > 0) {
      entries.push({
        jobId: input.intent.jobId,
        paymentIntentId: input.intent.id,
        transactionId: input.transactionId,
        actorType: 'PLATFORM',
        entryType: 'REVERSAL',
        amount: input.platformPart,
        currency: input.intent.currency,
        direction: 'DEBIT',
        balanceBucket: 'PLATFORM_RESERVED',
        description: 'Refund reversal on platform reserved fee',
        createdByUserId: input.actorUserId,
      });
    }

    if (heldDebit > 0) {
      entries.push({
        jobId: input.intent.jobId,
        paymentIntentId: input.intent.id,
        transactionId: input.transactionId,
        actorType: 'PROVIDER',
        entryType: 'REVERSAL',
        amount: heldDebit,
        currency: input.intent.currency,
        direction: 'DEBIT',
        balanceBucket: 'PROVIDER_HELD',
        description: 'Refund reversal debited from provider held balance',
        createdByUserId: input.actorUserId,
      });
    }

    if (availableDebit > 0) {
      entries.push({
        jobId: input.intent.jobId,
        paymentIntentId: input.intent.id,
        transactionId: input.transactionId,
        actorType: 'PROVIDER',
        entryType: 'REVERSAL',
        amount: availableDebit,
        currency: input.intent.currency,
        direction: 'DEBIT',
        balanceBucket: 'PROVIDER_AVAILABLE',
        description: 'Refund reversal debited from provider available balance',
        createdByUserId: input.actorUserId,
      });
    }

    entries.push({
      jobId: input.intent.jobId,
      paymentIntentId: input.intent.id,
      transactionId: input.transactionId,
      actorType: 'CUSTOMER',
      entryType: 'CUSTOMER_REFUND',
      amount: input.amount,
      currency: input.intent.currency,
      direction: 'CREDIT',
      balanceBucket: 'CUSTOMER_EXTERNAL',
      description: 'Customer refund settled',
      createdByUserId: input.actorUserId,
    });

    await this.ledgerService.appendEntries(prisma, entries);
  }

  private async applyGatewayStatus(
    prisma: Prisma.TransactionClient,
    input: {
      transaction: PaymentTransaction;
      gatewayStatus: GatewayOperationStatus;
      rawPayload?: Record<string, unknown>;
      reason?: string | null;
    },
  ) {
    const transactionStatus = this.mapGatewayToTransactionStatus(
      input.gatewayStatus,
    );

    const updatedTransaction = await prisma.paymentTransaction.update({
      where: { id: input.transaction.id },
      data: {
        status: transactionStatus,
        confirmedAmount:
          transactionStatus === 'SUCCEEDED'
            ? input.transaction.requestedAmount
            : input.transaction.confirmedAmount,
        providerPayload:
          (input.rawPayload as Prisma.InputJsonValue | undefined) ?? undefined,
        failureReason:
          transactionStatus === 'FAILED'
            ? (input.reason ?? 'provider_reported_failure')
            : null,
        processedAt: new Date(),
      },
    });

    if (updatedTransaction.paymentIntentId) {
      const intent = await prisma.paymentIntent.findUnique({
        where: { id: updatedTransaction.paymentIntentId },
      });

      if (!intent) {
        throw new NotFoundException('Payment intent not found');
      }

      const nextIntentStatus = this.mapGatewayToIntentStatus(
        input.gatewayStatus,
        {
          metadata: intent.metadata,
        },
      );
      if (
        [
          'PAID_PARTIAL',
          'SUCCEEDED',
          'FAILED',
          'PENDING_CONFIRMATION',
        ].includes(nextIntentStatus) &&
        intent.status !== nextIntentStatus
      ) {
        await prisma.paymentIntent.update({
          where: {
            id: intent.id,
          },
          data: {
            status: nextIntentStatus,
          },
        });
      }

      if (updatedTransaction.status === 'SUCCEEDED') {
        await this.ensureChargeLedgerEntries(prisma, {
          paymentIntentId: intent.id,
          transactionId: updatedTransaction.id,
          jobId: intent.jobId,
          amount: intent.amount,
          platformFeeAmount: intent.platformFeeAmount,
          providerNetAmount: intent.providerNetAmount,
        });

        await prisma.job.update({
          where: { id: intent.jobId },
          data: {
            contactUnlockedAt: new Date(),
          },
        });
      }
    }

    return updatedTransaction;
  }
}
