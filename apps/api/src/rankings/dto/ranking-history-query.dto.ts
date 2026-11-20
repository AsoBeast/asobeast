import { ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN } from '@asobeast/shared';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { BooleanQuery } from '../../common/validation/boolean-query.decorator';
import { NotBefore } from '../../common/validation/not-before.decorator';

export class RankingHistoryQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @NotBefore('from')
  to?: string;

  @IsOptional()
  @IsString()
  keywordIds?: string;

  @ApiPropertyOptional({
    example: 'us',
    pattern: COUNTRY_PATTERN.source,
    description:
      'Only the tracked keywords of this storefront. Omitted means every market the app tracks.',
  })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Also return the paused keywords. Ignored when keywordIds is given.',
  })
  @IsOptional()
  @BooleanQuery()
  @IsBoolean()
  includePaused?: boolean;
}
