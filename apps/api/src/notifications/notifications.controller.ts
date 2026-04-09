import {
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('notifications')
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
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'List notifications for current user' })
  @ApiOkResponse({ description: 'Notifications loaded' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  listMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listMine(req.user.sub, query);
  }

  @Post('me/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'Notifications marked as read' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiOkResponse({ description: 'Notification marked as read' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user.sub);
  }
}
