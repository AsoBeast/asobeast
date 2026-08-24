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
const APP_ID_PATH = /\/id(\d+)/i;

const APP_STORE_HOSTS = new Set(['apps.apple.com', 'itunes.apple.com']);
const GOOGLE_PLAY_HOST = 'play.google.com';

export function parseStoreUrl(input: string): ParsedStoreUrl {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidStoreUrlError(input);

  if (NUMERIC_ID.test(trimmed)) {
    return {
      store: 'APP_STORE',
      storeAppId: trimmed,
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

  const url = safeParseUrl(trimmed);
  if (!url) throw new InvalidStoreUrlError(input);

  const host = url.hostname.toLowerCase();

  if (APP_STORE_HOSTS.has(host)) {
    const match = url.pathname.match(APP_ID_PATH);
    if (!match) throw new InvalidStoreUrlError(input);
    const first = url.pathname.split('/').filter(Boolean)[0];
    const country =
      first && COUNTRY_SEGMENT.test(first)
        ? first.toLowerCase()
        : DEFAULT_COUNTRY;
    return { store: 'APP_STORE', storeAppId: match[1], country };
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

function safeParseUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}
