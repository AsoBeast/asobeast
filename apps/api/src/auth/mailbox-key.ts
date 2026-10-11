import { canonicalAddress, canonicalText } from './canonical-address';

const ADDRESS_ALIASES: Record<string, string> = {
  'googlemail.com': 'gmail.com',
};

const DOTLESS_DOMAINS: ReadonlySet<string> = new Set(['gmail.com']);

export function mailboxOf(email: string): string {
  const address = canonicalAddress(email);
  if (!address) return canonicalText(email);

  const domain = ADDRESS_ALIASES[address.domain] ?? address.domain;
  const withoutTag = withoutPlusTag(address.local);
  const local = DOTLESS_DOMAINS.has(domain)
    ? withoutTag.replaceAll('.', '')
    : withoutTag;
  return `${local}@${domain}`;
}

function withoutPlusTag(local: string): string {
  const plus = local.indexOf('+');
  return plus < 1 ? local : local.slice(0, plus);
}
