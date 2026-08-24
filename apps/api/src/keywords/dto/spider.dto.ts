import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COUNTRY_PATTERN, SpiderStartRequest } from '@asobeast/shared';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SpiderStartDto implements SpiderStartRequest {
  @ApiProperty({ example: 'habit tracker' })
  @Transform(lower)
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  term!: string;

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}

export class SpiderQueryDto implements SpiderStartRequest {
  @ApiProperty({ example: 'habit tracker' })
  @Transform(lower)
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  term!: string;

  @ApiPropertyOptional({ example: 'pl', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;
}
