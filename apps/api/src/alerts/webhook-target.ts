import { BlockList, isIP } from 'node:net';

export class WebhookTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookTargetError';
  }
}

const BLOCKED_V4: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const BLOCKED_V6: ReadonlyArray<[string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

const blocked = new BlockList();
for (const [address, prefix] of BLOCKED_V4) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of BLOCKED_V6) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];
const LOCAL_HOSTNAMES = new Set(['localhost', 'local', 'internal']);

export interface WebhookTargetOptions {
  allowPrivate?: boolean;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

function isLocalHostname(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) return true;
  return LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export function assertDeliverableUrl(
  raw: string,
  options: WebhookTargetOptions = {},
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebhookTargetError(`${raw} is not a valid url`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebhookTargetError(
      `${url.protocol}// is not a webhook scheme; use http or https`,
    );
  }
  if (url.username !== '' || url.password !== '') {
    throw new WebhookTargetError(
      'a webhook url must not embed credentials; use the shared secret instead',
    );
  }
  if (options.allowPrivate) return url;

  const hostname = url.hostname.replace(/^\[|]$/g, '').toLowerCase();
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    throw new WebhookTargetError(
      `${url.hostname} is a private or reserved address; webhooks may only reach public hosts`,
    );
  }
  if (isLocalHostname(hostname)) {
    throw new WebhookTargetError(
      `${url.hostname} resolves inside this network; webhooks may only reach public hosts`,
    );
  }
  return url;
}
