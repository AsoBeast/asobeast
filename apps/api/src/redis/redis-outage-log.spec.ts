import { Logger } from '@nestjs/common';
import { OUTAGE_WARN_INTERVAL_MS, RedisOutageLog } from './redis-outage-log';

const refused = () =>
  Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });

describe('RedisOutageLog', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-10T10:34:50Z') });
    warn = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('names the outage once for every source inside one interval', () => {
    const log = new RedisOutageLog();

    log.report(new Error('getaddrinfo ENOTFOUND redis'));
    log.report(
      new Error(
        "Stream isn't writeable and enableOfflineQueue options is false",
      ),
    );
    log.report(refused());

    expect(warn.mock.calls).toEqual([
      [
        'redis is unreachable, so queued work waits and request path reads and rate limits fail fast: getaddrinfo ENOTFOUND redis',
      ],
    ]);
  });

  it('names the outage again once the interval has passed', () => {
    const log = new RedisOutageLog();

    log.report(new Error('getaddrinfo ENOTFOUND redis'));
    jest.advanceTimersByTime(OUTAGE_WARN_INTERVAL_MS - 1);
    log.report(new Error('getaddrinfo ENOTFOUND redis'));
    jest.advanceTimersByTime(1);
    log.report(new Error('getaddrinfo ENOTFOUND redis'));

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('names the error code when the error carries no message', () => {
    new RedisOutageLog().report(refused());

    expect(warn).toHaveBeenCalledWith(
      'redis is unreachable, so queued work waits and request path reads and rate limits fail fast: ECONNREFUSED',
    );
  });
});
