import { fetch } from 'undici';
import { readBounded, ResponseTooLargeError } from '../bounded-body';

export const GCS_TRANSPORT = Symbol('GCS_TRANSPORT');
export const GCS_TIMEOUT_MS = 20_000;
export const GCS_DOWNLOAD_TIMEOUT_MS = 120_000;

export interface GcsRequest {
  method: 'GET' | 'POST';
  url: string;
  bearer?: string;
  form?: Record<string, string>;
  binary?: boolean;
  maxBytes?: number;
}

export interface GcsResponse {
  status: number;
  body: unknown;
  bytes?: Buffer<ArrayBuffer>;
}

export type GcsTransport = (request: GcsRequest) => Promise<GcsResponse>;

export class GcsUnreachableError extends Error {
  constructor(reason: string) {
    super(`Google did not answer: ${reason}`);
    this.name = 'GcsUnreachableError';
  }
}

const parseBody = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export function createGcsTransport({
  timeoutMs,
  downloadTimeoutMs,
}: {
  timeoutMs: number;
  downloadTimeoutMs: number;
}): GcsTransport {
  return async ({ method, url, bearer, form, binary, maxBytes }) => {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          ...(binary ? { 'accept-encoding': 'identity' } : {}),
          ...(form
            ? { 'content-type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        body: form ? new URLSearchParams(form).toString() : undefined,
        signal: AbortSignal.timeout(binary ? downloadTimeoutMs : timeoutMs),
        redirect: 'error',
      });
      if (binary && response.ok) {
        const limit = maxBytes ?? Number.POSITIVE_INFINITY;
        if (Number(response.headers.get('content-length') ?? 0) > limit) {
          await response.body?.cancel();
          throw new ResponseTooLargeError(limit);
        }
        return {
          status: response.status,
          body: null,
          bytes: await readBounded(response.body, limit),
        };
      }
      return {
        status: response.status,
        body: parseBody(await response.text()),
      };
    } catch (error) {
      if (error instanceof ResponseTooLargeError) throw error;
      throw new GcsUnreachableError(
        error instanceof Error ? error.message : String(error),
      );
    }
  };
}

export const undiciGcsTransport: GcsTransport = createGcsTransport({
  timeoutMs: GCS_TIMEOUT_MS,
  downloadTimeoutMs: GCS_DOWNLOAD_TIMEOUT_MS,
});
