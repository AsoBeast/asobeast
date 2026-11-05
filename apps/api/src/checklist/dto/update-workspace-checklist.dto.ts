import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  WORKSPACE_GOALS,
  type WorkspaceChecklistUpdateRequest,
  type WorkspaceGoal,
} from '@asobeast/shared';
import { IsBoolean, IsIn, ValidateIf } from 'class-validator';

const given = (_: object, value: unknown) => value !== undefined;
const named = (_: object, value: unknown) =>
  value !== undefined && value !== null;

export class UpdateWorkspaceChecklistDto implements WorkspaceChecklistUpdateRequest {
  @ApiPropertyOptional({
    enum: WORKSPACE_GOALS,
    nullable: true,
    example: 'improve_rankings',
  })
  @ValidateIf(named)
  @IsIn(WORKSPACE_GOALS)
  goal?: WorkspaceGoal | null;

  @ApiPropertyOptional({ example: true })
  @ValidateIf(given)
  @IsBoolean()
  dismissed?: boolean;
}
