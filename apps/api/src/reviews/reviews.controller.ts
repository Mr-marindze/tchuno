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
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('worker/:workerProfileId')
  @ApiOperation({ summary: 'List reviews by worker profile' })
  @ApiParam({ name: 'workerProfileId', type: String })
  @ApiOkResponse({ type: ReviewDto, isArray: true })
  listByWorker(@Param('workerProfileId') workerProfileId: string) {
    return this.reviewsService.listByWorkerProfile(workerProfileId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'List reviews created by current user' })
  @ApiOkResponse({ type: ReviewDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  listMine(@Req() req: AuthenticatedRequest) {
    return this.reviewsService.listMine(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create review for a completed job (client only)' })
  @ApiOkResponse({ type: ReviewDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(req.user.sub, dto);
  }
}
