import {
  SUPPORT_REASON_MAX_LENGTH,
  SUPPORT_REASON_MIN_LENGTH,
  type SupportActionRequest,
} from '@asobeast/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, Length } from 'class-validator';
import { Trimmed } from '../../common/validation/trimmed.decorator';

export class SupportActionDto implements SupportActionRequest {
  @ApiProperty({
    description: 'Must be true. A support action is never taken by accident',
  })
  @Equals(true)
  confirm!: true;

  @ApiProperty({
    description:
      'Why the action was taken. Spaces at its ends are removed before its length is checked. Stored in the support audit trail. A suspension also shows it to every member of the workspace on every page and in every refused write, so write it for the customer',
  })
  @Trimmed()
  @IsString()
  @Length(SUPPORT_REASON_MIN_LENGTH, SUPPORT_REASON_MAX_LENGTH)
  reason!: string;
}
