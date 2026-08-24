export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  'dispostable.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@').at(-1)?.trim().toLowerCase();
  return domain !== undefined && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
