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

  @ApiProperty({ nullable: true })
  budget!: number | null;

  @ApiProperty({ enum: ['FIXED_PRICE', 'QUOTE_REQUEST'] })
  pricingMode!: 'FIXED_PRICE' | 'QUOTE_REQUEST';

  @ApiProperty({ nullable: true })
  quotedAmount!: number | null;

  @ApiProperty({ nullable: true })
  quoteMessage!: string | null;

  @ApiProperty({
    enum: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'],
  })
  status!: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

  @ApiProperty({ nullable: true })
  scheduledFor!: Date | null;

  @ApiProperty({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ nullable: true })
  acceptedAt!: Date | null;

  @ApiProperty({ nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ nullable: true })
  canceledAt!: Date | null;

  @ApiProperty({ nullable: true })
  canceledBy!: string | null;

  @ApiProperty({ nullable: true })
  cancelReason!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
