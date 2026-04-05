import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppRole } from '../auth/authorization.types';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PayPaymentIntentDto } from './dto/pay-payment-intent.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { ReconcileTransactionDto } from './dto/reconcile-transaction.dto';
import { PaymentsService } from './payments.service';

type AuthenticatedRequest = {
  user: {
    sub: string;
  };
  authz?: {
    role?: AppRole;
  };
};

type WebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
};

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intents')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment intent for a customer job' })
  @ApiOkResponse({ description: 'Payment intent created or reused' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.payments.create')
  createIntent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createIntent(req.user.sub, dto);
  }

  @Post('intents/:id/pay')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay a pending payment intent (customer)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Payment intent charge result' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.payments.create')
  payIntent(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: PayPaymentIntentDto,
  ) {
    return this.paymentsService.payIntent(id, req.user.sub, dto);
  }

  @Get('intents/:id')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment intent by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Payment intent details' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequireAppRoles(
    'customer',
    'provider',
    'admin',
    'ops_admin',
    'support_admin',
    'super_admin',
  )
  getIntentById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentsService.getIntentById(id, {
      userId: req.user.sub,
      role: req.authz?.role,
    });
  }

  @Get('jobs/:jobId')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get financial state for one job' })
  @ApiParam({ name: 'jobId', type: String })
  @ApiOkResponse({ description: 'Job financial state' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequireAppRoles(
    'customer',
    'provider',
    'admin',
    'ops_admin',
    'support_admin',
    'super_admin',
  )
  getJobFinancialState(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.paymentsService.getJobFinancialState(jobId, {
      userId: req.user.sub,
      role: req.authz?.role,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my customer payment intents' })
  @ApiOkResponse({ description: 'Paginated customer intents' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.payments.read.own')
  listMyCustomerIntents(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.paymentsService.listMyCustomerIntents(req.user.sub, query);
  }

  @Get('provider/summary')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get provider earnings balances and history' })
  @ApiOkResponse({ description: 'Provider earnings summary' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.earnings.read.own')
  getProviderSummary(@Req() req: AuthenticatedRequest) {
    return this.paymentsService.getProviderSummary(req.user.sub);
  }

  @Post('webhooks/:provider')
  @ApiOperation({ summary: 'Receive provider webhook callback' })
  @ApiParam({ name: 'provider', enum: PaymentProvider })
  @ApiOkResponse({ description: 'Webhook accepted' })
  webhook(
    @Param('provider', new ParseEnumPipe(PaymentProvider))
    provider: PaymentProvider,
    @Body() dto: PaymentWebhookDto,
    @Req() req: WebhookRequest,
  ) {
    const signatureHeader = req.headers['x-tchuno-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    return this.paymentsService.handleWebhook(provider, dto, {
      signature,
    });
  }

  @Post('transactions/:id/reconcile')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger transaction status reconciliation' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Reconciliation result' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  reconcileTransaction(
    @Param('id') id: string,
    @Body() dto: ReconcileTransactionDto,
  ) {
    return this.paymentsService.reconcileTransaction(id, dto);
  }
}
