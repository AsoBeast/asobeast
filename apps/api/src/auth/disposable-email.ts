import { blacklist } from 'mailchecker';
import { canonicalAddress } from './canonical-address';

const DISPOSABLE_EMAIL_DOMAINS = blacklist();

export function isDisposableEmail(email: string): boolean {
  let domain = canonicalAddress(email)?.domain;
  while (domain) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
    const dot = domain.indexOf('.');
    domain = dot === -1 ? undefined : domain.slice(dot + 1);
  }
  return false;
}
