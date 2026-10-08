import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  APP_STORE_LOCALIZATION_IDS,
  type AppStoreLocalization,
} from '@asobeast/shared';
import { IsIn, IsOptional } from 'class-validator';
import { ListingMarketQueryDto } from './listing-market-query.dto';

export class ListingQueryDto extends ListingMarketQueryDto {
  @ApiPropertyOptional({
    example: 'pl',
    enum: APP_STORE_LOCALIZATION_IDS,
    description:
      'A native localization of the storefront to read instead of its default listing. App Store only.',
  })
  @IsOptional()
  @IsIn(APP_STORE_LOCALIZATION_IDS)
  localization?: AppStoreLocalization;
}
