import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { ActionBulkUpdateRequest, QUERY_BOUNDS } from '@asobeast/shared';
import { ActionTransitionDto } from './action-transition.dto';

const IDS = QUERY_BOUNDS.actionBulkIds;

export class BulkUpdateActionsDto
  extends ActionTransitionDto
  implements ActionBulkUpdateRequest
{
  @ApiProperty({ type: [String], minItems: IDS.min, maxItems: IDS.max })
  @IsArray()
  @ArrayMinSize(IDS.min)
  @ArrayMaxSize(IDS.max)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];
}
