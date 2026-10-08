import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('answers with the work when it settles in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1_000)).resolves.toBe(
      'done',
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes the rejection of the work through', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 1_000),
    ).rejects.toThrow('boom');
  });

  it('rejects once the time is up', async () => {
    const pending = withTimeout(new Promise(() => undefined), 1_000);
    const outcome = expect(pending).rejects.toThrow('no answer in 1000 ms');

    await jest.advanceTimersByTimeAsync(1_000);

    await outcome;
  });

  it('rejects with the message it is given', async () => {
    const pending = withTimeout(new Promise(() => undefined), 50, 'too slow');
    const outcome = expect(pending).rejects.toThrow('too slow');

    await jest.advanceTimersByTimeAsync(50);

    await outcome;
  });
});
