import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  API_TOKEN_MAX_EXPIRY_DAYS,
  API_TOKEN_SCOPES,
  ApiTokenCreateRequest,
  ApiTokenScope,
} from '@asobeast/shared';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTokenDto implements ApiTokenCreateRequest {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: API_TOKEN_SCOPES, default: 'read' })
  @IsOptional()
  @IsIn(API_TOKEN_SCOPES)
  scope?: ApiTokenScope;

  @ApiPropertyOptional({ minimum: 1, maximum: API_TOKEN_MAX_EXPIRY_DAYS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(API_TOKEN_MAX_EXPIRY_DAYS)
  expiresInDays?: number;
}
