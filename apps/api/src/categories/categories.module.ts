import { Module } from '@nestjs/common';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, AdminRoleGuard],
})
export class CategoriesModule {}
