import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppImportRequest, COUNTRY_PATTERN } from '@asobeast/shared';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ImportAppDto implements AppImportRequest {
  @ApiProperty({
    example:
      'https://apps.apple.com/us/app/where-am-i-geoguess-map-quiz/id6657987209',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({ example: 'de', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
