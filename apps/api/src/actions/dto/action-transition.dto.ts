import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsISO8601, IsOptional } from 'class-validator';
import {
  ACTION_DISMISS_REASONS,
  ACTION_UPDATE_STATUSES,
  ActionDismissReason,
  ActionUpdateStatus,
} from '@asobeast/shared';

export class ActionTransitionDto {
  @ApiProperty({ enum: ACTION_UPDATE_STATUSES })
  @IsIn(ACTION_UPDATE_STATUSES)
  status!: ActionUpdateStatus;

  @ApiPropertyOptional({ example: '2026-08-15T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  snoozedUntil?: string;

  @ApiPropertyOptional({ enum: ACTION_DISMISS_REASONS })
  @IsOptional()
  @IsIn(ACTION_DISMISS_REASONS)
  reason?: ActionDismissReason;

  @ApiPropertyOptional({
    description: 'Undo the latest change instead of making a new one',
  })
  @IsOptional()
  @IsBoolean()
  revert?: boolean;
}
