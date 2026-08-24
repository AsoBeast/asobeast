import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  ActionCategory,
  ActionPriority,
  ActionRule,
  ActionStatus,
  COUNTRY_PATTERN,
  QUERY_BOUNDS,
  STORES,
  Store,
} from '@asobeast/shared';

export const ACTIONS_DEFAULT_LIMIT = QUERY_BOUNDS.actionsLimit.default;
export const ACTIONS_MAX_LIMIT = QUERY_BOUNDS.actionsLimit.max;
export const ACTIONS_DEFAULT_STATUSES: readonly ActionStatus[] = [
  'OPEN',
  'SNOOZED',
];

const toArray = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return value;
};

export class ListActionsQueryDto {
  @ApiPropertyOptional({ enum: ACTION_STATUSES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(ACTION_STATUSES, { each: true })
  status?: ActionStatus[];

  @ApiPropertyOptional({ enum: ACTION_PRIORITIES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(ACTION_PRIORITIES, { each: true })
  priority?: ActionPriority[];

  @ApiPropertyOptional({ enum: ACTION_RULES, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(ACTION_RULES, { each: true })
  rule?: ActionRule[];

  @ApiPropertyOptional({ enum: ACTION_CATEGORIES })
  @IsOptional()
  @IsIn(ACTION_CATEGORIES)
  category?: ActionCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appId?: string;

  @ApiPropertyOptional({ example: 'us', pattern: COUNTRY_PATTERN.source })
  @IsOptional()
  @Matches(COUNTRY_PATTERN)
  country?: string;

  @ApiPropertyOptional({ enum: STORES })
  @IsOptional()
  @IsIn(STORES)
  store?: Store;

  @ApiPropertyOptional({ default: ACTIONS_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(QUERY_BOUNDS.actionsLimit.min)
  @Max(ACTIONS_MAX_LIMIT)
  limit = ACTIONS_DEFAULT_LIMIT;
}
