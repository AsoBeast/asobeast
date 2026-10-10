import { DISPATCH_TIMEOUT_MS } from '../mcp/in-process.gateway';
import {
  ON_DEMAND_STORE_DEADLINE_MS,
  storeDeadline,
  withinStoreDeadline,
} from './store-deadline';

const WEB_PROXY_TIMEOUT_MS = 30_000;

const elapse = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('storeDeadline', () => {
  it('carries no signal outside an on demand request', () => {
    expect(storeDeadline()).toEqual({});
  });

  it('carries one signal across the awaits of an on demand request', async () => {
    const [before, after] = await withinStoreDeadline(async () => {
      const first = storeDeadline().signal;
      await elapse(1);
      return [first, storeDeadline().signal];
    });

    expect(before).toBeInstanceOf(AbortSignal);
    expect(after).toBe(before);
    expect(before?.aborted).toBe(false);
  });

  it('gives every request its own deadline', () => {
    const first = withinStoreDeadline(() => storeDeadline().signal);
    const second = withinStoreDeadline(() => storeDeadline().signal);

    expect(second).not.toBe(first);
  });

  it('aborts with a timeout once the deadline passes', async () => {
    const signal = withinStoreDeadline(() => storeDeadline().signal, 10);

    await elapse(40);

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toMatchObject({ name: 'TimeoutError' });
  });

  it('gives up before the mcp gateway and the web proxy do', () => {
    expect(ON_DEMAND_STORE_DEADLINE_MS).toBeLessThan(DISPATCH_TIMEOUT_MS);
    expect(DISPATCH_TIMEOUT_MS).toBeLessThan(WEB_PROXY_TIMEOUT_MS);
  });
});
