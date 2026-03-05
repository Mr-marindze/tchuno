import { ApiProperty } from '@nestjs/swagger';

export class WorkerProfileCategoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class WorkerProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  bio!: string | null;

  @ApiProperty({ nullable: true })
  location!: string | null;

  @ApiProperty({ nullable: true })
  hourlyRate!: number | null;

  @ApiProperty()
  experienceYears!: number;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty()
  ratingAvg!: string;

  @ApiProperty()
  ratingCount!: number;

  @ApiProperty({ type: WorkerProfileCategoryItemDto, isArray: true })
  categories!: WorkerProfileCategoryItemDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
