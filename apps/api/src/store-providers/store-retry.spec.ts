import { Abortable, withinStoreDeadline } from './store-deadline';
import { retryStoreCall, STORE_RETRY_DELAYS_MS } from './store-retry';

const always = () => true;

describe('retryStoreCall', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits two then five seconds between tries', () => {
    expect(STORE_RETRY_DELAYS_MS).toEqual([2000, 5000]);
  });

  it('answers the first success without waiting', async () => {
    jest.useFakeTimers();
    const call = jest.fn().mockResolvedValue('ok');

    await expect(retryStoreCall(call, always)).resolves.toBe('ok');

    expect(call).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('asks again after each delay while the error is retryable', async () => {
    jest.useFakeTimers();
    const call = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('ok');

    const promise = retryStoreCall(call, always);
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last delay with the last error', async () => {
    jest.useFakeTimers();
    const third = new Error('third');
    const call = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(third);

    const promise = retryStoreCall(call, always);
    const assertion = expect(promise).rejects.toBe(third);
    await jest.runAllTimersAsync();
    await assertion;

    expect(call).toHaveBeenCalledTimes(3);
  });

  it('stops at once on an error that is not retryable', async () => {
    jest.useFakeTimers();
    const failure = new Error('final');
    const call = jest.fn().mockRejectedValue(failure);

    await expect(retryStoreCall(call, () => false)).rejects.toBe(failure);

    expect(call).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('asks the predicate about each error it met', async () => {
    jest.useFakeTimers();
    const first = new Error('first');
    const second = new Error('second');
    const call = jest
      .fn()
      .mockRejectedValueOnce(first)
      .mockRejectedValue(second);
    const retryable = jest.fn((error: unknown) => error === first);

    const promise = retryStoreCall(call, retryable);
    const assertion = expect(promise).rejects.toBe(second);
    await jest.runAllTimersAsync();
    await assertion;

    expect(call).toHaveBeenCalledTimes(2);
    expect(retryable.mock.calls).toEqual([[first], [second]]);
  });

  it('answers the deadline, not the unconfirmed error, when the deadline cuts the pause short', async () => {
    const failure = new Error('missing');
    const call = jest.fn().mockRejectedValue(failure);
    const started = Date.now();

    const settled = await withinStoreDeadline(
      () => retryStoreCall(call, always).catch((error: unknown) => error),
      50,
    );

    expect(settled).not.toBe(failure);
    expect(settled).toMatchObject({ name: 'TimeoutError' });

    expect(call).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(STORE_RETRY_DELAYS_MS[0]);
  });

  it('starts no call once the deadline has passed', async () => {
    const call = jest.fn().mockResolvedValue('late');

    await expect(
      withinStoreDeadline(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return retryStoreCall(call, always);
      }, 5),
    ).rejects.toThrow();

    expect(call).not.toHaveBeenCalled();
  });

  it('hands every try the same deadline', async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const call = jest.fn((deadline: Abortable) => {
      signals.push(deadline.signal);
      return signals.length < 3
        ? Promise.reject(new Error('again'))
        : Promise.resolve('ok');
    });

    jest.useFakeTimers();
    const promise = withinStoreDeadline(
      () => retryStoreCall(call, always),
      60_000,
    );
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(signals).toHaveLength(3);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(new Set(signals).size).toBe(1);
  });
});
