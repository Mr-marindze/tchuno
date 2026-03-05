import { PartialType } from '@nestjs/swagger';
import { UpsertWorkerProfileDto } from './upsert-worker-profile.dto';

export class UpdateWorkerProfileDto extends PartialType(
  UpsertWorkerProfileDto,
) {}
