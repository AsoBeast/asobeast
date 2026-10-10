import { Matches } from 'class-validator';

export class UnsubscribeEmailAlertDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
