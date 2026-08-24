import { createHmac } from 'node:crypto';

export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export function deliveryHeaders(
  event: string,
  body: string,
  secret: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Asobeast-Event': event,
  };
  if (secret) {
    headers['X-Asobeast-Signature'] = signPayload(secret, body);
  }
  return headers;
}
