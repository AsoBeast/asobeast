import { isIP } from 'node:net';

export class ResponseTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`The response is larger than the ${limit} bytes expected`);
    this.name = 'ResponseTooLargeError';
  }
}

export async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Buffer<ArrayBuffer>> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > limit) {
      await body.cancel().catch(() => undefined);
      throw new ResponseTooLargeError(limit);
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const PRIVATE_SUFFIXES = ['localhost', '.localhost', '.local', '.internal'];

export function isPublicHttps(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    url.protocol === 'https:' &&
    host.length > 0 &&
    isIP(host) === 0 &&
    !PRIVATE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(suffix))
  );
}
