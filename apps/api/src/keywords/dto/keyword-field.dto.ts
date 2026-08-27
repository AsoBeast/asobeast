import { ApiProperty } from '@nestjs/swagger';
import {
  KEYWORD_FIELD_INPUT_LIMIT,
  KeywordFieldRequest,
} from '@asobeast/shared';
import { IsString, MaxLength } from 'class-validator';

export class KeywordFieldDto implements KeywordFieldRequest {
  @ApiProperty({
    example: 'habit,tracker,streak,daily goals',
    maxLength: KEYWORD_FIELD_INPUT_LIMIT,
  })
  @IsString()
  @MaxLength(KEYWORD_FIELD_INPUT_LIMIT)
  text!: string;
}
