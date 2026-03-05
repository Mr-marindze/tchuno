import { IsIn } from 'class-validator';

export class UpdateJobStatusDto {
  @IsIn(['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'])
  status!: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
}
