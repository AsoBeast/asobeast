import { domainToASCII } from 'node:url';

export interface CanonicalAddress {
  local: string;
  domain: string;
}

export function canonicalText(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

export function canonicalAddress(email: string): CanonicalAddress | null {
  const address = canonicalText(email);
  const at = address.lastIndexOf('@');
  if (at < 1) return null;
  return {
    local: unquoted(address.slice(0, at)),
    domain: asciiDomain(address.slice(at + 1)),
  };
}

function unquoted(local: string): string {
  return local.length > 1 && local.startsWith('"') && local.endsWith('"')
    ? local.slice(1, -1)
    : local;
}

function asciiDomain(domain: string): string {
  const bare = domain.replace(/\.$/, '');
  return domainToASCII(bare) || bare;
}
