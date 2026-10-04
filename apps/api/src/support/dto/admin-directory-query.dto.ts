import { ApiPropertyOptional } from '@nestjs/swagger';
import { ALL_WORKSPACES } from '@asobeast/shared';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

const WORKSPACE_ID_MAX = 64;

export class AdminDirectoryQueryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: WORKSPACE_ID_MAX })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(WORKSPACE_ID_MAX)
  @NotEquals(ALL_WORKSPACES)
  workspaceId?: string;
}
