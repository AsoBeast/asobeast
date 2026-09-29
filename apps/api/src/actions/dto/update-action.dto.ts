import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';
import { ActionUpdateRequest } from '@asobeast/shared';
import { ActionTransitionDto } from './action-transition.dto';

export const ACTION_NOTE_MAX_LENGTH = 500;

export class UpdateActionDto
  extends ActionTransitionDto
  implements ActionUpdateRequest
{
  @ApiPropertyOptional({ maxLength: ACTION_NOTE_MAX_LENGTH })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(ACTION_NOTE_MAX_LENGTH)
  note?: string;
}
