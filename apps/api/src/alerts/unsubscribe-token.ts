import { isLinkToken, linkToken } from './link-token';

const PURPOSE = 'email-alert-unsubscribe';

export interface UnsubscribeRecipient {
  alertId: string;
  email: string;
}

const partsOf = ({ alertId, email }: UnsubscribeRecipient): string[] => [
  alertId,
  email.toLowerCase(),
];

export function unsubscribeToken(
  secret: string,
  recipient: UnsubscribeRecipient,
): string {
  return linkToken(secret, PURPOSE, partsOf(recipient));
}

export function isUnsubscribeToken(
  secret: string,
  recipient: UnsubscribeRecipient,
  token: string,
): boolean {
  return isLinkToken(secret, PURPOSE, partsOf(recipient), token);
}
