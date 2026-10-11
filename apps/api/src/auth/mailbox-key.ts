const ADDRESS_ALIASES: Record<string, string> = {
  'googlemail.com': 'gmail.com',
};

const DOTLESS_DOMAINS: ReadonlySet<string> = new Set(['gmail.com']);

export function mailboxOf(email: string): string {
  const address = email.normalize('NFKC').trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 1) return address;

  const rawDomain = address.slice(at + 1).replace(/\.$/, '');
  const domain = ADDRESS_ALIASES[rawDomain] ?? rawDomain;
  const withoutTag = withoutPlusTag(address.slice(0, at));
  const local = DOTLESS_DOMAINS.has(domain)
    ? withoutTag.replaceAll('.', '')
    : withoutTag;
  return `${local}@${domain}`;
}

function withoutPlusTag(local: string): string {
  const plus = local.indexOf('+');
  return plus < 1 ? local : local.slice(0, plus);
}
