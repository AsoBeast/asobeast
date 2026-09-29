import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { COUNTRY_PATTERN, STORES, Store } from '@asobeast/shared';

export class ActionScopeQueryDto {
  @ApiPropertyOptional({ description: 'Restrict to one app' })
  @IsOptional()
  @IsString()
  appId?: string;

  @ApiPropertyOptional({ enum: STORES })
  @IsOptional()
  @IsIn(STORES)
  store?: Store;

  @ApiPropertyOptional({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
