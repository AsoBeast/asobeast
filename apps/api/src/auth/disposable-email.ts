import { blacklist } from 'mailchecker';

const DISPOSABLE_EMAIL_DOMAINS = blacklist();

export function isDisposableEmail(email: string): boolean {
  let domain = email.split('@').at(-1)?.trim().toLowerCase();
  while (domain) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
    const dot = domain.indexOf('.');
    domain = dot === -1 ? undefined : domain.slice(dot + 1);
  }
  return false;
}
