import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, ValidateIf } from 'class-validator';
import { ACTION_NOTE_MAX_LENGTH, ActionUpdateRequest } from '@asobeast/shared';
import { ActionTransitionDto } from './action-transition.dto';

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
