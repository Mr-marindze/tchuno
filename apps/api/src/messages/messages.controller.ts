import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobMessageDto } from './dto/create-job-message.dto';
import { MessagesService } from './messages.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@RequireAppRoles(
  'customer',
  'provider',
  'admin',
  'support_admin',
  'ops_admin',
  'super_admin',
)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('me')
  @ApiOperation({ summary: 'List my job conversations' })
  @ApiOkResponse({ description: 'Conversations loaded' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  listMine(@Req() req: AuthenticatedRequest) {
    return this.messagesService.listMine(req.user.sub);
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'List messages for one job conversation' })
  @ApiOkResponse({ description: 'Conversation loaded' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  listByJob(@Req() req: AuthenticatedRequest, @Param('jobId') jobId: string) {
    return this.messagesService.listByJob(jobId, req.user.sub);
  }

  @Post('jobs/:jobId')
  @ApiOperation({ summary: 'Send a message in one job conversation' })
  @ApiOkResponse({ description: 'Message sent' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  send(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() dto: CreateJobMessageDto,
  ) {
    return this.messagesService.send(jobId, req.user.sub, dto);
  }

  @Post('jobs/:jobId/read')
  @ApiOperation({ summary: 'Mark messages as read for the current user' })
  @ApiOkResponse({ description: 'Conversation marked as read' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  markJobRead(@Req() req: AuthenticatedRequest, @Param('jobId') jobId: string) {
    return this.messagesService.markJobRead(jobId, req.user.sub);
  }
}
