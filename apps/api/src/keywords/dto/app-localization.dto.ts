import { ApiProperty } from '@nestjs/swagger';
import {
  type AddAppLocalizationRequest,
  APP_STORE_LOCALIZATION_IDS,
  type AppStoreLocalization,
} from '@asobeast/shared';
import { IsIn } from 'class-validator';

export class AddAppLocalizationDto implements AddAppLocalizationRequest {
  @ApiProperty({ enum: APP_STORE_LOCALIZATION_IDS, example: 'es-MX' })
  @IsIn(APP_STORE_LOCALIZATION_IDS)
  localization!: AppStoreLocalization;
}
