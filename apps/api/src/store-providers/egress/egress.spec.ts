import type { Dispatcher } from 'undici';

jest.mock('undici', () => ({
  fetch: jest.fn(() => Promise.resolve({ ok: true })),
  ProxyAgent: jest.fn(),
}));

import { fetch as undiciFetch, ProxyAgent } from 'undici';
import {
  currentEgress,
  currentMeter,
  EgressMeter,
  egressFetch,
  installEgressFetch,
  proxyDispatcher,
  restoreDirectFetch,
  throughEgress,
} from './egress';

interface EgressInit {
  dispatcher?: Dispatcher;
}

const undiciFetchMock = undiciFetch as unknown as jest.Mock<
  Promise<unknown>,
  [unknown, EgressInit | undefined]
>;
const proxyAgentMock = ProxyAgent as unknown as jest.Mock;

const dispatcherNamed = (name: string): Dispatcher =>
  ({ name }) as unknown as Dispatcher;

const lastFetchInit = (): EgressInit =>
  undiciFetchMock.mock.calls.at(-1)?.[1] ?? {};

describe('proxy egress', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    undiciFetchMock.mockReset().mockResolvedValue({ status: 200 });
    proxyAgentMock.mockClear();
  });

  afterEach(() => {
    restoreDirectFetch();
    globalThis.fetch = realFetch;
  });

  it('exposes no dispatcher outside a scope', () => {
    expect(currentEgress()).toBeUndefined();
  });

  it('keeps concurrent scopes on their own dispatcher', async () => {
    const first = dispatcherNamed('first');
    const second = dispatcherNamed('second');
    const seen = (dispatcher: Dispatcher, delay: number) =>
      throughEgress(dispatcher, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return currentEgress();
      });

    const [a, b] = await Promise.all([seen(first, 5), seen(second, 0)]);

    expect(a).toBe(first);
    expect(b).toBe(second);
    expect(currentEgress()).toBeUndefined();
  });

  it('forwards the scoped dispatcher to the request', async () => {
    const dispatcher = dispatcherNamed('scoped');

    await throughEgress(dispatcher, () =>
      egressFetch('https://itunes.apple.com/search'),
    );

    expect(lastFetchInit().dispatcher).toBe(dispatcher);
  });

  it('sends no dispatcher when nothing is in scope', async () => {
    await egressFetch('https://itunes.apple.com/search');

    expect(lastFetchInit().dispatcher).toBeUndefined();
  });

  it('routes a library that calls global fetch through the scoped dispatcher', async () => {
    const direct = jest.fn(() => Promise.resolve(new Response('direct')));
    globalThis.fetch = direct;
    installEgressFetch();
    const dispatcher = dispatcherNamed('library');

    await throughEgress(dispatcher, () =>
      globalThis.fetch('https://apps.apple.com/us/app/id1'),
    );

    expect(direct).not.toHaveBeenCalled();
    expect(lastFetchInit().dispatcher).toBe(dispatcher);
  });

  it('leaves requests outside a scope on the direct connection', async () => {
    const direct = jest.fn(() => Promise.resolve(new Response('direct')));
    globalThis.fetch = direct;
    installEgressFetch();

    await globalThis.fetch('https://api.openai.com/v1/responses');

    expect(direct).toHaveBeenCalledTimes(1);
    expect(undiciFetchMock).not.toHaveBeenCalled();
  });

  it('installs the wrapper once and restores the direct connection', () => {
    const direct = jest.fn();
    globalThis.fetch = direct;
    installEgressFetch();
    const wrapped = globalThis.fetch;
    installEgressFetch();

    expect(globalThis.fetch).toBe(wrapped);

    restoreDirectFetch();

    expect(globalThis.fetch).toBe(direct);
  });

  it('counts every outbound call a library made under one lease', async () => {
    undiciFetchMock.mockResolvedValue({ status: 200 });
    const meter = new EgressMeter(dispatcherNamed('metered'));
    installEgressFetch();

    await throughEgress(meter, async () => {
      await globalThis.fetch('https://play.google.com/store/apps/details');
      await globalThis.fetch('https://play.google.com/store/search');
      await globalThis.fetch('https://play.google.com/store/search?page=2');
    });

    expect(meter.requests).toBe(3);
    expect(meter.failures).toHaveLength(0);
  });

  it('marks the request the path refused so a swallowed block still counts', async () => {
    undiciFetchMock
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 403 });
    const meter = new EgressMeter(dispatcherNamed('blocked'));

    await throughEgress(meter, async () => {
      await egressFetch('https://itunes.apple.com/search');
      await egressFetch('https://itunes.apple.com/lookup');
    });

    expect(meter.requests).toBe(2);
    expect(meter.failures).toHaveLength(1);
    expect((meter.failures[0] as Error).message).toContain('403');
  });

  it('marks a thrown transport failure and still lets it reach the caller', async () => {
    const dropped = new Error('socket hang up');
    undiciFetchMock.mockRejectedValueOnce(dropped);
    const meter = new EgressMeter(dispatcherNamed('dropped'));

    await expect(
      throughEgress(meter, () =>
        egressFetch('https://itunes.apple.com/search'),
      ),
    ).rejects.toBe(dropped);

    expect(meter.requests).toBe(1);
    expect(meter.failures).toEqual([dropped]);
  });

  it('leaves an ordinary store answer unmarked', async () => {
    undiciFetchMock.mockResolvedValue({ status: 404 });
    const meter = new EgressMeter(dispatcherNamed('missing'));

    await throughEgress(meter, () =>
      egressFetch('https://itunes.apple.com/lookup'),
    );

    expect(meter.failures).toHaveLength(0);
  });

  it('exposes the meter of the scope a library is running in', async () => {
    const meter = new EgressMeter(dispatcherNamed('scoped'));

    await expect(
      throughEgress(meter, () => Promise.resolve(currentMeter())),
    ).resolves.toBe(meter);
    expect(currentMeter()).toBeUndefined();
  });

  it('carries credentials in the proxy authorization header, not the uri', () => {
    proxyDispatcher('http://proxy.example:8080', {
      username: 'pool',
      password: 'secret',
    });

    expect(proxyAgentMock).toHaveBeenCalledWith({
      uri: 'http://proxy.example:8080',
      token: `Basic ${Buffer.from('pool:secret').toString('base64')}`,
    });
  });

  it('omits the authorization header for an anonymous proxy', () => {
    proxyDispatcher('http://proxy.example:8080');

    expect(proxyAgentMock).toHaveBeenCalledWith({
      uri: 'http://proxy.example:8080',
    });
  });
});
