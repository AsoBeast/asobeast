import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  APPLE_ADS_CREDENTIALS,
  appleAdsEnabled,
  assertAppleAdsConfiguration,
} from './apple-ads-config';

const keyDirectory = mkdtempSync(join(tmpdir(), 'apple-ads-'));
const keyPath = join(keyDirectory, 'private-key.pem');
writeFileSync(keyPath, 'key');

const complete = {
  APPLE_ADS_CLIENT_ID: 'SEARCHADS.client',
  APPLE_ADS_TEAM_ID: 'SEARCHADS.team',
  APPLE_ADS_KEY_ID: 'key',
  APPLE_ADS_PRIVATE_KEY_PATH: keyPath,
};

const without = (name: keyof typeof complete) => ({
  ...complete,
  [name]: undefined,
});

describe('apple ads configuration', () => {
  afterAll(() => rmSync(keyDirectory, { recursive: true, force: true }));

  it('is off when nothing is set', () => {
    const env = {
      APPLE_ADS_CLIENT_ID: undefined,
      APPLE_ADS_TEAM_ID: undefined,
      APPLE_ADS_KEY_ID: undefined,
      APPLE_ADS_PRIVATE_KEY_PATH: undefined,
    };
    expect(appleAdsEnabled(env)).toBe(false);
    expect(() => assertAppleAdsConfiguration(env)).not.toThrow();
  });

  it('is on when every credential is set', () => {
    expect(appleAdsEnabled(complete)).toBe(true);
    expect(() => assertAppleAdsConfiguration(complete)).not.toThrow();
  });

  it.each(APPLE_ADS_CREDENTIALS)('refuses to boot without %s', (name) => {
    expect(appleAdsEnabled(without(name))).toBe(false);
    expect(() => assertAppleAdsConfiguration(without(name))).toThrow(
      `Apple Ads is partly configured. Set ${name} or remove every APPLE_ADS_ variable.`,
    );
  });

  it('refuses to boot when the key file cannot be read', () => {
    const missingKey = join(keyDirectory, 'missing.pem');
    const env = { ...complete, APPLE_ADS_PRIVATE_KEY_PATH: missingKey };
    expect(() => assertAppleAdsConfiguration(env)).toThrow(
      `Apple Ads is configured but APPLE_ADS_PRIVATE_KEY_PATH cannot be read at ${missingKey}. Put the key in apps/api/keys, where the Compose stacks mount it, or remove every APPLE_ADS_ variable.`,
    );
  });

  it('never repeats a credential value in the error', () => {
    expect(() =>
      assertAppleAdsConfiguration(without('APPLE_ADS_KEY_ID')),
    ).toThrow(
      expect.not.objectContaining({
        message: expect.stringContaining('SEARCHADS') as string,
      }) as Error,
    );
  });
});
