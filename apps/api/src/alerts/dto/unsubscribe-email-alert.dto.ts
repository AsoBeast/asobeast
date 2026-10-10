import { Matches } from 'class-validator';
import { UNSUBSCRIBE_TOKEN_PATTERN } from '../unsubscribe-token';

export class UnsubscribeEmailAlertDto {
  @Matches(UNSUBSCRIBE_TOKEN_PATTERN)
  token!: string;
}
