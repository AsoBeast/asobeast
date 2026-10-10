import type { EmailContent } from './render-email';

export interface OutgoingMail extends EmailContent {
  to: string;
}
