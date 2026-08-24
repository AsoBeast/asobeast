import { ApiProperty } from '@nestjs/swagger';
import { KeywordFieldRequest } from '@asobeast/shared';
import { IsString } from 'class-validator';

export class KeywordFieldDto implements KeywordFieldRequest {
  @ApiProperty({ example: 'habit,tracker,streak,daily goals' })
  @IsString()
  text!: string;
}
