import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ALERT_FEED_EVENTS,
  QUERY_BOUNDS,
  type AlertFeedEvent,
} from '@asobeast/shared';
import { commaList } from '../../common/comma-list';

const LIMIT = QUERY_BOUNDS.alertEventsLimit;

export class ListAlertEventsQueryDto {
  @ApiPropertyOptional({ enum: ALERT_FEED_EVENTS, isArray: true })
  @IsOptional()
  @Transform(commaList)
  @IsArray()
  @IsIn(ALERT_FEED_EVENTS, { each: true })
  type?: AlertFeedEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appId?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  since?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({
    minimum: LIMIT.min,
    maximum: LIMIT.max,
    default: LIMIT.default,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIMIT.min)
  @Max(LIMIT.max)
  limit: number = LIMIT.default;
}
