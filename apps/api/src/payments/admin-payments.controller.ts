import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
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
import { AppRole } from '../auth/authorization.types';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireReauth } from '../auth/decorators/require-reauth.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminActionAuditInterceptor } from '../auth/interceptors/admin-action-audit.interceptor';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { RejectRefundRequestDto } from './dto/reject-refund-request.dto';
import { TriggerReconciliationDto } from './dto/trigger-reconciliation.dto';
import { PaymentsService } from './payments.service';

type AdminRequest = {
  user: {
    sub: string;
  };
  authz?: {
    role?: AppRole;
  };
};

@ApiTags('admin-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@UseInterceptors(AdminActionAuditInterceptor)
@RequireAppRoles('admin', 'ops_admin', 'support_admin', 'super_admin')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Financial overview for admin operations' })
  @ApiOkResponse({ description: 'Payments overview KPIs' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.read')
  overview() {
    return this.paymentsService.adminOverview();
  }

  @Get('intents')
  @ApiOperation({ summary: 'List payment intents (admin)' })
  @ApiOkResponse({ description: 'Paginated payment intents' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.read')
  intents(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.adminListIntents(query);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List payment transactions (admin)' })
  @ApiOkResponse({ description: 'Paginated transactions' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.read')
  transactions(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.adminListTransactions(query);
  }

  @Get('refunds')
  @ApiOperation({ summary: 'List refund requests (admin)' })
  @ApiOkResponse({ description: 'Paginated refunds' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.read')
  refunds(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.adminListRefunds(query);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'List payout requests (admin)' })
  @ApiOkResponse({ description: 'Paginated payouts' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.read')
  payouts(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.adminListPayouts(query);
  }

  @Post('refunds')
  @ApiOperation({ summary: 'Create and process a refund request' })
  @ApiOkResponse({ description: 'Refund created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.refund')
  createRefund(@Req() req: AdminRequest, @Body() dto: CreateRefundRequestDto) {
    return this.paymentsService.adminCreateRefund(req.user.sub, dto);
  }

  @Post('refunds/:id/approve')
  @ApiOperation({ summary: 'Approve and process a pending refund request' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Refund processed' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.refund')
  approveRefund(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.paymentsService.adminApproveRefund(req.user.sub, id);
  }

  @Post('refunds/:id/reject')
  @ApiOperation({ summary: 'Reject a pending refund request' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Refund request rejected' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.refund')
  rejectRefund(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: RejectRefundRequestDto,
  ) {
    return this.paymentsService.adminRejectRefund(req.user.sub, id, dto);
  }

  @Post('payouts')
  @ApiOperation({ summary: 'Create payout request for provider balance' })
  @ApiOkResponse({ description: 'Payout created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.payout.create')
  createPayout(@Req() req: AdminRequest, @Body() dto: CreatePayoutDto) {
    return this.paymentsService.adminCreatePayout(req.user.sub, dto);
  }

  @Post('payouts/:id/approve')
  @ApiOperation({ summary: 'Approve payout request' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Payout approved' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.payout.approve')
  approvePayout(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.paymentsService.adminApprovePayout(req.user.sub, id);
  }

  @Post('payouts/:id/process')
  @ApiOperation({ summary: 'Process approved payout' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Payout processing result' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.payout.process')
  processPayout(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: ProcessPayoutDto,
  ) {
    return this.paymentsService.adminProcessPayout(req.user.sub, id, dto);
  }

  @Post('release/:jobId')
  @ApiOperation({ summary: 'Release provider held funds for completed job' })
  @ApiParam({ name: 'jobId', type: String })
  @ApiOkResponse({ description: 'Funds released' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  @RequireReauth('admin.payments.release')
  releaseFunds(@Req() req: AdminRequest, @Param('jobId') jobId: string) {
    return this.paymentsService.adminReleaseProviderFunds(req.user.sub, jobId);
  }

  @Post('reconcile/pending')
  @ApiOperation({
    summary: 'Trigger reconciliation for stale pending charge transactions',
  })
  @ApiOkResponse({ description: 'Pending reconciliation summary' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.payments.manage')
  reconcilePending(@Body() dto: TriggerReconciliationDto) {
    return this.paymentsService.reconcilePendingChargeTransactions({
      source: 'manual',
      limit: dto.limit,
      minAgeMinutes: dto.minAgeMinutes,
    });
  }
}
