import { ApiProperty } from '@nestjs/swagger';
import { KeywordDiscoverySettingsRequest } from '@asobeast/shared';
import { IsBoolean } from 'class-validator';

export class KeywordDiscoverySettingsDto implements KeywordDiscoverySettingsRequest {
  @ApiProperty()
  @IsBoolean()
  autoTrackRanked!: boolean;
}
