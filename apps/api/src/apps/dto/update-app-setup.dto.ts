import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppSetupUpdateRequest,
  COUNTRY_PATTERN,
  SETUP_MARKETS_MAX,
  SETUP_STATUSES,
  SETUP_STEPS,
  SetupStatus,
  SetupStep,
} from '@asobeast/shared';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  Matches,
  ValidateIf,
} from 'class-validator';

const given = (_: object, value: unknown) => value !== undefined;

export class UpdateAppSetupDto implements AppSetupUpdateRequest {
  @ApiPropertyOptional({ enum: SETUP_STATUSES, example: 'in_progress' })
  @ValidateIf(given)
  @IsIn(SETUP_STATUSES)
  status?: SetupStatus;

  @ApiPropertyOptional({
    enum: SETUP_STEPS,
    isArray: true,
    example: ['competitors'],
  })
  @ValidateIf(given)
  @IsArray()
  @ArrayUnique()
  @IsIn(SETUP_STEPS, { each: true })
  skipped?: SetupStep[];

  @ApiPropertyOptional({ example: true })
  @ValidateIf(given)
  @IsBoolean()
  countriesReviewed?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['us', 'de'],
    minItems: 1,
    maxItems: SETUP_MARKETS_MAX,
  })
  @ValidateIf(given)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SETUP_MARKETS_MAX)
  @ArrayUnique()
  @Matches(COUNTRY_PATTERN, { each: true })
  selectedMarkets?: string[];
}
