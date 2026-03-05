import { ApiProperty } from '@nestjs/swagger';

export class JobDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  workerProfileId!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  budget!: number;

  @ApiProperty({
    enum: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'],
  })
  status!: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

  @ApiProperty({ nullable: true })
  scheduledFor!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ nullable: true })
  canceledAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
