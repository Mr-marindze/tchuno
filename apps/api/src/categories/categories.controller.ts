import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireReauth } from '../auth/decorators/require-reauth.decorator';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminActionAuditInterceptor } from '../auth/interceptors/admin-action-audit.interceptor';
import { CategoriesService } from './categories.service';
import { CategoryDto } from './dto/category.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories' })
  @ApiOkResponse({ type: CategoryDto, isArray: true })
  list(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: CategoryDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  getById(@Param('id') id: string) {
    return this.categoriesService.getById(id);
  }

  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @UseInterceptors(AdminActionAuditInterceptor)
  @RequirePermissions('admin.categories.manage')
  @RequireReauth('admin.categories.create')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create category' })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @UseInterceptors(AdminActionAuditInterceptor)
  @RequirePermissions('admin.categories.manage')
  @RequireReauth('admin.categories.update')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: CategoryDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @UseInterceptors(AdminActionAuditInterceptor)
  @RequirePermissions('admin.categories.manage')
  @RequireReauth('admin.categories.remove')
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate category' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
