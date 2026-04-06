import {
  Body,
  Controller,
  Get,
  Param,
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
import { AppRole } from '../auth/authorization.types';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { CreateRequestInvitationDto } from './dto/create-request-invitation.dto';
import { ListServiceRequestsQueryDto } from './dto/list-service-requests-query.dto';
import { SelectProposalDto } from './dto/select-proposal.dto';
import { SubmitProposalDto } from './dto/submit-proposal.dto';
import { ServiceRequestsService } from './service-requests.service';

type AuthenticatedRequest = {
  user: {
    sub: string;
  };
  authz?: {
    role?: AppRole;
  };
};

@ApiTags('service-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create open service request (customer)' })
  @ApiOkResponse({ description: 'Service request created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.requests.create')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.serviceRequestsService.create(req.user.sub, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List own service requests (customer)' })
  @ApiOkResponse({ description: 'Paginated list of own service requests' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.requests.read.own')
  listMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListServiceRequestsQueryDto,
  ) {
    return this.serviceRequestsService.listMine(req.user.sub, query);
  }

  @Get('open')
  @ApiOperation({ summary: 'List open service requests for providers' })
  @ApiOkResponse({ description: 'Paginated list of open requests' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.requests.read.open')
  listOpen(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListServiceRequestsQueryDto,
  ) {
    return this.serviceRequestsService.listOpenForProvider(req.user.sub, query);
  }

  @Get('invitations/mine')
  @ApiOperation({ summary: 'List request invitations for current provider' })
  @ApiOkResponse({
    description: 'List invitations received by current provider',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.requests.read.invites')
  listMineInvitations(@Req() req: AuthenticatedRequest) {
    return this.serviceRequestsService.listMineInvitations(req.user.sub);
  }

  @Post('invitations/:invitationId/decline')
  @ApiOperation({ summary: 'Decline one request invitation (provider)' })
  @ApiParam({ name: 'invitationId', type: String })
  @ApiOkResponse({ description: 'Invitation declined' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.requests.decline.invite')
  declineInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('invitationId') invitationId: string,
  ) {
    return this.serviceRequestsService.declineInvitation(
      invitationId,
      req.user.sub,
    );
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List invitations for one own service request' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'List invitations with provider snapshots' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.requests.read.own')
  listInvitations(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.serviceRequestsService.listRequestInvitations(id, req.user.sub);
  }

  @Post(':id/invitations')
  @ApiOperation({
    summary: 'Invite one provider to submit proposal on request',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Invitation created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.requests.invite')
  createInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateRequestInvitationDto,
  ) {
    return this.serviceRequestsService.createInvitation(id, req.user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one own service request with proposals/job' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Service request detail for customer owner' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.requests.read.own')
  getMineById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.serviceRequestsService.getMineById(req.user.sub, id);
  }

  @Post(':id/proposals')
  @ApiOperation({
    summary: 'Submit proposal for open service request (provider)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Proposal created/updated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.requests.propose')
  submitProposal(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubmitProposalDto,
  ) {
    return this.serviceRequestsService.submitProposal(id, req.user.sub, dto);
  }

  @Get(':id/proposals')
  @ApiOperation({ summary: 'List proposals for one service request' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'List proposals with provider snapshots' })
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
  listProposals(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.serviceRequestsService.listRequestProposals(id, {
      userId: req.user.sub,
      role: req.authz?.role,
    });
  }

  @Post(':id/select/:proposalId')
  @ApiOperation({
    summary:
      'Select one proposal (customer), create job and create deposit payment intent',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'proposalId', type: String })
  @ApiOkResponse({
    description: 'Proposal selected and job/payment initialized',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.requests.select')
  selectProposal(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @Body() dto: SelectProposalDto,
  ) {
    return this.serviceRequestsService.selectProposal(
      id,
      proposalId,
      req.user.sub,
      dto,
    );
  }
}
