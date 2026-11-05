import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ALERT_FEED_EVENTS,
  QUERY_BOUNDS,
  type AlertEventQuery,
  type AlertFeedEvent,
} from '@asobeast/shared';
import { commaList } from '../../common/comma-list';

const LIMIT = QUERY_BOUNDS.alertEventsLimit;

const UTC_DATE_OR_INSTANT =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

export class ListAlertEventsQueryDto implements AlertEventQuery {
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
  @Matches(UTC_DATE_OR_INSTANT, {
    message: 'since must be a date or an instant with a time zone',
  })
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
