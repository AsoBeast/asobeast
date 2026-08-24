import { ApiProperty } from '@nestjs/swagger';
import { DELETION_CONFIRMATION } from '@asobeast/shared';
import { Equals } from 'class-validator';

export class RequestDeletionDto {
  @ApiProperty({
    description: `Must be the literal ${DELETION_CONFIRMATION}`,
    enum: [DELETION_CONFIRMATION],
  })
  @Equals(DELETION_CONFIRMATION)
  confirm!: string;
}
