import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const WORKSPACE_ID_MAX = 64;

export class AdminDirectoryQueryDto {
  @ApiPropertyOptional({ maxLength: WORKSPACE_ID_MAX })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(WORKSPACE_ID_MAX)
  workspaceId?: string;
}
