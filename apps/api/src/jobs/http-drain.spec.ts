import { Logger } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { HttpDrain } from './http-drain';

const hostOf = (httpAdapter: unknown) =>
  ({ httpAdapter }) as unknown as HttpAdapterHost;

describe('HttpDrain', () => {
  const closeAllConnections = jest.fn<void, []>();
  const drain = () =>
    new HttpDrain(hostOf({ getHttpServer: () => ({ closeAllConnections }) }));

  beforeEach(() => {
    jest.useFakeTimers();
    closeAllConnections.mockReset();
    jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('leaves the connections alone until the delay has passed', () => {
    drain().cutAfter(2_000);

    jest.advanceTimersByTime(1_999);
    expect(closeAllConnections).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
  });

  it('cuts once however often it is asked', () => {
    const subject = drain();
    subject.cutAfter(2_000);
    subject.cutAfter(500);

    jest.advanceTimersByTime(5_000);

    expect(closeAllConnections).toHaveBeenCalledTimes(1);
  });

  it('cuts nothing when the application finished shutting down first', () => {
    const subject = drain();
    subject.cutAfter(2_000);

    subject.onApplicationShutdown();
    jest.advanceTimersByTime(5_000);

    expect(closeAllConnections).not.toHaveBeenCalled();
  });

  it('names the cut in the log', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
    drain().cutAfter(2_000);

    jest.advanceTimersByTime(2_000);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('cut the http connections still open'),
    );
  });

  it.each([
    ['no http adapter', hostOf(undefined)],
    ['no http server', hostOf({ getHttpServer: () => undefined })],
  ])('does nothing with %s', (_label, host) => {
    new HttpDrain(host).cutAfter(2_000);

    expect(jest.getTimerCount()).toBe(0);
  });
});
