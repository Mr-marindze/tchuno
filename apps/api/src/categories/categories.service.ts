import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCategoriesQueryDto) {
    return this.prisma.category.findMany({
      where: query.includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const slug = this.normalizeSlug(dto.slug ?? name);

    try {
      return await this.prisma.category.create({
        data: {
          name,
          slug,
          description: dto.description?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      this.handlePrismaConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureCategoryExists(id);

    const data: Prisma.CategoryUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.slug !== undefined ? { slug: this.normalizeSlug(dto.slug) } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handlePrismaConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.ensureCategoryExists(id);

    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private normalizeSlug(input: string): string {
    const slug = input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    if (!slug) {
      throw new ConflictException('Unable to generate a valid slug');
    }

    return slug;
  }

  private async ensureCategoryExists(id: string) {
    const exists = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Category not found');
    }
  }

  private handlePrismaConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Category name or slug already exists');
    }
  }
}
