import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, Length } from 'class-validator';

export class SupportActionDto {
  @ApiProperty({
    description: 'Must be true. A support action is never taken by accident',
  })
  @Equals(true)
  confirm!: true;

  @ApiProperty({
    description: 'Why the action was taken. Stored in the support audit trail',
  })
  @IsString()
  @Length(8, 200)
  reason!: string;
}
