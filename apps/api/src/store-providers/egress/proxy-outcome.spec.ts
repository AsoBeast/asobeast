import { ProxyOutcome, Store } from '@prisma/client';
import { ImplausibleResultError, StoreRequestError } from '../errors';
import { outcomeOf } from './proxy-health.service';
import { classifyFailure, cooldownMs } from './proxy-outcome';
import { ProxyPoolUnavailableError } from './proxy-pool.service';

describe('proxy failure classification', () => {
  it('separates a throttle from a block', () => {
    expect(classifyFailure('Request failed with status 429')).toBe(
      ProxyOutcome.RATE_LIMITED,
    );
    expect(classifyFailure('Request failed with status 403')).toBe(
      ProxyOutcome.BLOCKED,
    );
  });

  it('reads a consent interstitial and a captcha as a block', () => {
    expect(classifyFailure('captcha challenge presented')).toBe(
      ProxyOutcome.BLOCKED,
    );
    expect(classifyFailure('redirected to the consent page')).toBe(
      ProxyOutcome.BLOCKED,
    );
  });

  it('reads a broken connection as the proxy, not the store', () => {
    for (const message of [
      'connect ECONNREFUSED 10.0.0.1:8080',
      'socket hang up',
      'fetch failed',
      'UND_ERR_CONNECT_TIMEOUT',
    ]) {
      expect(classifyFailure(message)).toBe(ProxyOutcome.TRANSPORT);
    }
  });

  it('leaves an unrecognised failure unattributed', () => {
    expect(classifyFailure('unexpected end of JSON input')).toBeNull();
  });

  it('backs off further with every consecutive failure', () => {
    expect(cooldownMs(ProxyOutcome.TRANSPORT, 1)).toBe(30_000);
    expect(cooldownMs(ProxyOutcome.TRANSPORT, 2)).toBe(60_000);
    expect(cooldownMs(ProxyOutcome.TRANSPORT, 3)).toBe(120_000);
  });

  it('cools a block down far longer than a dropped connection', () => {
    expect(cooldownMs(ProxyOutcome.BLOCKED, 1)).toBeGreaterThan(
      cooldownMs(ProxyOutcome.TRANSPORT, 1),
    );
    expect(cooldownMs(ProxyOutcome.SILENT, 1)).toBeGreaterThan(
      cooldownMs(ProxyOutcome.RATE_LIMITED, 1),
    );
  });

  it('caps the backoff so an endpoint can always come back', () => {
    expect(cooldownMs(ProxyOutcome.BLOCKED, 99)).toBe(24 * 60 * 60_000);
  });

  it('never cools down after a success', () => {
    expect(cooldownMs(ProxyOutcome.SUCCESS, 5)).toBe(0);
  });
});

describe('outcomeOf', () => {
  it('classifies the cause a store request wrapped', () => {
    expect(
      outcomeOf(
        new StoreRequestError(Store.APP_STORE, 'search', 'status 429 received'),
      ),
    ).toBe(ProxyOutcome.RATE_LIMITED);
  });

  it('treats an implausible result as a silent failure', () => {
    expect(
      outcomeOf(new ImplausibleResultError(Store.GOOGLE_PLAY, 'no results')),
    ).toBe(ProxyOutcome.SILENT);
  });

  it('blames no endpoint when the pool never handed one out', () => {
    expect(
      outcomeOf(new ProxyPoolUnavailableError(Store.APP_STORE, 1)),
    ).toBeNull();
  });

  it('blames no endpoint for a failure that is not about the network', () => {
    expect(outcomeOf(new Error('workspace missing'))).toBeNull();
    expect(outcomeOf('boom')).toBeNull();
  });
});
