import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { UNSUBSCRIBE_TOKEN_PATTERN } from '../unsubscribe-token';

export class UnsubscribeEmailAlertDto {
  @ApiProperty({ pattern: UNSUBSCRIBE_TOKEN_PATTERN.source })
  @Matches(UNSUBSCRIBE_TOKEN_PATTERN)
  token!: string;
}
