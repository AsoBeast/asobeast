import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AscRequester } from './asc-requester';
import { AscTokenCache } from './asc-token';
import type { AscRequest, AscResponse, AscTransport } from './asc-transport';

export const ascFixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'asc', `${name}.json`), 'utf8'),
  ) as unknown;

const PEM = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

export const ok = (body: unknown, status = 200): AscResponse => ({
  status,
  body,
  retryAfter: null,
});

export const failure = (status: number, code: string): AscResponse => ({
  status,
  body: {
    errors: [{ status: String(status), code, detail: `${code} detail` }],
  },
  retryAfter: null,
});

export const requesterOn = (
  transport: AscTransport,
  pause: (ms: number) => Promise<unknown> = () => Promise.resolve(),
): AscRequester =>
  new AscRequester(
    transport,
    new AscTokenCache({
      issuerId: 'issuer',
      keyId: 'KEY1234567',
      privateKey: PEM,
    }),
    pause,
  );

export function recordedRequester(...responses: AscResponse[]) {
  const requests: AscRequest[] = [];
  const queue = [...responses];
  const transport: AscTransport = (request) => {
    requests.push(request);
    const next = queue.shift();
    return next
      ? Promise.resolve(next)
      : Promise.reject(new Error('no response queued'));
  };
  const pause = jest.fn(() => Promise.resolve());
  return { requester: requesterOn(transport, pause), requests, pause };
}
