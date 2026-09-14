import { DEFAULT_COUNTRY, Store } from './index';

export class InvalidStoreUrlError extends Error {
  constructor(input: string) {
    super(`Unrecognized store URL or id: ${input}`);
    this.name = 'InvalidStoreUrlError';
  }
}

export interface ParsedStoreUrl {
  store: Store;
  storeAppId: string;
  country: string;
}

const NUMERIC_ID = /^\d+$/;
const PACKAGE_NAME = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
const COUNTRY_SEGMENT = /^[a-z]{2}$/i;
const APP_LISTING_PATH = /(?:^|\/)app\/(?:[^/]+\/)?id(\d+)(?:\/|$)/i;
const LEADING_ZEROS = /^0+(?=\d)/;

const APP_STORE_HOSTS = new Set(['apps.apple.com', 'itunes.apple.com']);
const GOOGLE_PLAY_HOST = 'play.google.com';
const STORE_HOSTS = new Set([...APP_STORE_HOSTS, GOOGLE_PLAY_HOST]);

export function parseStoreUrl(input: string): ParsedStoreUrl {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidStoreUrlError(input);

  if (NUMERIC_ID.test(trimmed)) {
    return {
      store: 'APP_STORE',
      storeAppId: appStoreId(trimmed, input),
      country: DEFAULT_COUNTRY,
    };
  }

  if (!trimmed.includes('/') && PACKAGE_NAME.test(trimmed)) {
    return {
      store: 'GOOGLE_PLAY',
      storeAppId: trimmed,
      country: DEFAULT_COUNTRY,
    };
  }

  const url = safeParseUrl(withScheme(trimmed));
  if (!url) throw new InvalidStoreUrlError(input);

  const host = url.hostname.toLowerCase();

  if (APP_STORE_HOSTS.has(host)) {
    const match = url.pathname.match(APP_LISTING_PATH);
    if (!match) throw new InvalidStoreUrlError(input);
    const first = url.pathname.split('/').filter(Boolean)[0];
    const country =
      first && COUNTRY_SEGMENT.test(first)
        ? first.toLowerCase()
        : DEFAULT_COUNTRY;
    return {
      store: 'APP_STORE',
      storeAppId: appStoreId(match[1], input),
      country,
    };
  }

  if (host === GOOGLE_PLAY_HOST) {
    const id = url.searchParams.get('id');
    if (!id || !PACKAGE_NAME.test(id)) throw new InvalidStoreUrlError(input);
    const gl = url.searchParams.get('gl');
    return {
      store: 'GOOGLE_PLAY',
      storeAppId: id,
      country: gl ? gl.toLowerCase() : DEFAULT_COUNTRY,
    };
  }

  throw new InvalidStoreUrlError(input);
}

function appStoreId(digits: string, input: string): string {
  const canonical = digits.replace(LEADING_ZEROS, '');
  const value = Number(canonical);
  if (value === 0 || !Number.isSafeInteger(value)) {
    throw new InvalidStoreUrlError(input);
  }
  return canonical;
}

function withScheme(input: string): string {
  const host = input.split(/[/?#]/, 1)[0].toLowerCase();
  return STORE_HOSTS.has(host) ? `https://${input}` : input;
}

function safeParseUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}
