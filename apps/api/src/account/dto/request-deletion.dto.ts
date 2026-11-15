import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DELETION_CONFIRMATION,
  DELETION_REASONS,
  type DeletionReason,
  type WorkspaceDeletionRequest,
} from '@asobeast/shared';
import { Equals, IsIn, IsOptional } from 'class-validator';

export class RequestDeletionDto implements WorkspaceDeletionRequest {
  @ApiProperty({
    description: `Must be the literal ${DELETION_CONFIRMATION}`,
    enum: [DELETION_CONFIRMATION],
  })
  @Equals(DELETION_CONFIRMATION)
  confirm!: string;

  @ApiPropertyOptional({
    description:
      'Why the workspace is leaving, from a fixed list; kept without any personal data after erasure',
    enum: DELETION_REASONS,
  })
  @IsOptional()
  @IsIn(DELETION_REASONS)
  reason?: DeletionReason;
}
