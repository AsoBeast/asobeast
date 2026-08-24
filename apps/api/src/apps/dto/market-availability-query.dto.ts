import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { COUNTRY_PATTERN } from '@asobeast/shared';

export class MarketAvailabilityQueryDto {
  @ApiProperty({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @Matches(COUNTRY_PATTERN)
  country!: string;
}
