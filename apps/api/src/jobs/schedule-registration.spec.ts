import { QueueBase } from 'bullmq';
import {
  REGISTRATION_RETRY_MS,
  registerInBackground,
} from './schedule-registration';

const exhausted = () =>
  Object.assign(new Error('Reached the max retries per request limit'), {
    name: 'MaxRetriesPerRequestError',
  });

describe('registerInBackground', () => {
  const queue = { closing: undefined } as unknown as QueueBase;
  const report = jest.fn<void, [Error]>();

  beforeEach(() => {
    jest.useFakeTimers();
    report.mockReset();
    (queue as { closing: Promise<void> | undefined }).closing = undefined;
  });

  afterEach(() => jest.useRealTimers());

  it('registers again once redis had been down too long for the first attempt', async () => {
    const register = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(exhausted())
      .mockResolvedValue(undefined);

    registerInBackground(queue, register, report);
    await jest.advanceTimersByTimeAsync(REGISTRATION_RETRY_MS);

    expect(register).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('reports a fault once and does not retry it', async () => {
    const register = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new Error('Invalid cron pattern'));

    registerInBackground(queue, register, report);
    await jest.advanceTimersByTimeAsync(REGISTRATION_RETRY_MS * 3);

    expect(register).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(new Error('Invalid cron pattern'));
  });

  it('stops retrying once the queue is closing', async () => {
    const register = jest.fn<Promise<void>, []>().mockImplementation(() => {
      (queue as { closing: Promise<void> | undefined }).closing =
        Promise.resolve();
      return Promise.reject(new Error('Connection is closed.'));
    });

    registerInBackground(queue, register, report);
    await jest.advanceTimersByTimeAsync(REGISTRATION_RETRY_MS * 3);

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('reports a rejection that carries no error instead of losing it', async () => {
    const register = jest.fn<Promise<void>, []>().mockRejectedValue(undefined);

    registerInBackground(queue, register, report);
    await jest.advanceTimersByTimeAsync(0);

    expect(report).toHaveBeenCalledWith(new Error('undefined'));
  });
});
