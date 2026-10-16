import { fetch } from 'undici';
import { AscUnreachableError } from './asc-errors';
import { readBounded, ResponseTooLargeError } from './bounded-body';

export const ASC_TRANSPORT = Symbol('ASC_TRANSPORT');
export const ASC_ORIGIN = 'https://api.appstoreconnect.apple.com';
export const ASC_TIMEOUT_MS = 20_000;
export const ASC_DOWNLOAD_TIMEOUT_MS = 120_000;

export interface AscRequest {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  token?: string;
  body?: unknown;
  absoluteUrl?: string;
  maxBytes?: number;
}

export interface AscResponse {
  status: number;
  body: unknown;
  bytes?: Buffer;
  retryAfter: string | null;
}

export type AscTransport = (request: AscRequest) => Promise<AscResponse>;

interface AscTransportOptions {
  origin: string;
  timeoutMs: number;
  downloadTimeoutMs: number;
}

const parseBody = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function createAscTransport({
  origin,
  timeoutMs,
  downloadTimeoutMs,
}: AscTransportOptions): AscTransport {
  return async ({ method, path, token, body, absoluteUrl, maxBytes }) => {
    const download = absoluteUrl !== undefined;
    try {
      const response = await fetch(absoluteUrl ?? `${origin}${path}`, {
        method,
        headers: {
          ...(token && !download ? { authorization: `Bearer ${token}` } : {}),
          ...(download
            ? { 'accept-encoding': 'identity' }
            : { accept: 'application/json' }),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(download ? downloadTimeoutMs : timeoutMs),
        redirect: 'error',
      });
      const retryAfter = response.headers.get('retry-after');
      if (download && response.ok) {
        const limit = maxBytes ?? Number.POSITIVE_INFINITY;
        if (Number(response.headers.get('content-length') ?? 0) > limit) {
          await response.body?.cancel();
          throw new ResponseTooLargeError(limit);
        }
        return {
          status: response.status,
          body: null,
          bytes: await readBounded(response.body, limit),
          retryAfter,
        };
      }
      return {
        status: response.status,
        body: parseBody(await response.text()),
        retryAfter,
      };
    } catch (error) {
      if (error instanceof ResponseTooLargeError) throw error;
      throw new AscUnreachableError(reasonOf(error));
    }
  };
}

export const undiciTransport: AscTransport = createAscTransport({
  origin: ASC_ORIGIN,
  timeoutMs: ASC_TIMEOUT_MS,
  downloadTimeoutMs: ASC_DOWNLOAD_TIMEOUT_MS,
});
