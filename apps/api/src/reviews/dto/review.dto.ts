import { ApiProperty } from '@nestjs/swagger';

export class ReviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  workerProfileId!: string;

  @ApiProperty()
  reviewerId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating!: number;

  @ApiProperty({ nullable: true })
  comment!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
