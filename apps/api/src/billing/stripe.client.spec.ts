import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STRIPE_API_VERSION,
  STRIPE_APP_INFO,
  STRIPE_MAX_NETWORK_RETRIES,
  STRIPE_TIMEOUT_MS,
  createStripeClient,
} from './stripe.client';

const FIXTURES = join(__dirname, '..', '..', 'test', 'fixtures', 'stripe');

function fixtureVersions(): string[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const event = JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as {
        api_version: string;
      };
      return event.api_version;
    });
}

describe('createStripeClient', () => {
  it('pins the api version the fixtures were captured on', () => {
    const client = createStripeClient('sk_test_placeholder');
    expect(client?.getApiField('version')).toBe(STRIPE_API_VERSION);
    expect(new Set(fixtureVersions())).toEqual(new Set([STRIPE_API_VERSION]));
  });

  it('gives up on a call after twenty seconds and says who is calling', () => {
    const client = createStripeClient('sk_test_placeholder');
    expect(client?.getApiField('timeout')).toBe(STRIPE_TIMEOUT_MS);
    expect(client?.getMaxNetworkRetries()).toBe(STRIPE_MAX_NETWORK_RETRIES);
    expect(client?.getAppInfoAsString()).toContain(STRIPE_APP_INFO.name);
  });

  it('is inert without a key', () => {
    expect(createStripeClient(undefined)).toBeNull();
  });
});
