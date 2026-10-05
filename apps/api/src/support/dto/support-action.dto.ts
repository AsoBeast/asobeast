import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, Length } from 'class-validator';

export class SupportActionDto {
  @ApiProperty({
    description: 'Must be true. A support action is never taken by accident',
  })
  @Equals(true)
  confirm!: true;

  @ApiProperty({
    description:
      'Why the action was taken. Stored in the support audit trail. A suspension also shows it to every member of the workspace on every page and in every refused write, so write it for the customer',
  })
  @IsString()
  @Length(8, 200)
  reason!: string;
}
