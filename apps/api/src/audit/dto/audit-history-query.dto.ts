import { IsISO8601, IsOptional } from 'class-validator';
import { NotBefore } from '../../common/validation/not-before.decorator';

export class AuditHistoryQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @NotBefore('from')
  to?: string;
}
