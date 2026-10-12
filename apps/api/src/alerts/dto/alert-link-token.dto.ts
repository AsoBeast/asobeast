import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { LINK_TOKEN_PATTERN } from '../link-token';

export class AlertLinkTokenDto {
  @ApiProperty({ pattern: LINK_TOKEN_PATTERN.source })
  @Matches(LINK_TOKEN_PATTERN)
  token!: string;
}
