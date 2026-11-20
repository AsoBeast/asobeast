import { ApiPropertyOptional } from '@nestjs/swagger';
import { ALL_WORKSPACES, WORKSPACE_ID_MAX_LENGTH } from '@asobeast/shared';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

export class AdminDirectoryQueryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: WORKSPACE_ID_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(WORKSPACE_ID_MAX_LENGTH)
  @NotEquals(ALL_WORKSPACES)
  workspaceId?: string;
}
