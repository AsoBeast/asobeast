import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { COUNTRY_PATTERN, MarketSeedRequest } from '@asobeast/shared';

export class MarketSeedDto implements MarketSeedRequest {
  @ApiProperty({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @Matches(COUNTRY_PATTERN)
  country!: string;
}
