import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  APP_STORE_LOCALIZATION_IDS,
  AppStoreLocalization,
  MetadataAssistantRequest,
  METADATA_FIELDS,
  MetadataField,
} from '@asobeast/shared';

export class MetadataAssistantDto implements MetadataAssistantRequest {
  @ApiPropertyOptional({ enum: METADATA_FIELDS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn([...METADATA_FIELDS], { each: true })
  fields?: MetadataField[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @ApiPropertyOptional({
    enum: APP_STORE_LOCALIZATION_IDS,
    description:
      'An App Store localization to draft instead of the primary listing. Refused for a Google Play app',
  })
  @IsOptional()
  @IsIn([...APP_STORE_LOCALIZATION_IDS])
  localization?: AppStoreLocalization;
}
