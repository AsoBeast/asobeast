import { ApiProperty } from '@nestjs/swagger';
import { ALL_WORKSPACES, WORKSPACE_ID_MAX_LENGTH } from '@asobeast/shared';
import { IsNotEmpty, IsString, MaxLength, NotEquals } from 'class-validator';

export class SupportWorkspaceParamDto {
  @ApiProperty({ minLength: 1, maxLength: WORKSPACE_ID_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(WORKSPACE_ID_MAX_LENGTH)
  @NotEquals(ALL_WORKSPACES)
  workspaceId!: string;
}

export class BillingEventParamDto extends SupportWorkspaceParamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId!: string;
}
