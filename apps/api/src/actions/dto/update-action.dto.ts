import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ACTION_UPDATE_STATUSES,
  ActionUpdateRequest,
  ActionUpdateStatus,
} from '@asobeast/shared';

export const ACTION_NOTE_MAX_LENGTH = 500;

export class UpdateActionDto implements ActionUpdateRequest {
  @ApiProperty({ enum: ACTION_UPDATE_STATUSES })
  @IsIn(ACTION_UPDATE_STATUSES)
  status!: ActionUpdateStatus;

  @ApiPropertyOptional({ example: '2026-08-15T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  snoozedUntil?: string;

  @ApiPropertyOptional({ maxLength: ACTION_NOTE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(ACTION_NOTE_MAX_LENGTH)
  note?: string;
}
