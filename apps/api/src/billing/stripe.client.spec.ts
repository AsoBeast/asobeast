import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STRIPE_API_VERSION, createStripeClient } from './stripe.client';

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

  it('is inert without a key', () => {
    expect(createStripeClient(undefined)).toBeNull();
  });
});
