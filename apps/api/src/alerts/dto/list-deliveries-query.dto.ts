import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  webhookId?: string;

  @IsOptional()
  @IsString()
  emailAlertId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
