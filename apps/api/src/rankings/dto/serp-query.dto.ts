import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { UTC_DATE_PATTERN } from '@asobeast/shared';

export class SerpQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-21',
    pattern: UTC_DATE_PATTERN.source,
  })
  @IsOptional()
  @Matches(UTC_DATE_PATTERN)
  date?: string;
}
