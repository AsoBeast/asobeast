import type { Env } from './env';

export const APPLE_ADS_CREDENTIALS = [
  'APPLE_ADS_CLIENT_ID',
  'APPLE_ADS_TEAM_ID',
  'APPLE_ADS_KEY_ID',
  'APPLE_ADS_PRIVATE_KEY_PATH',
] as const;

type AppleAdsCredentials = Pick<Env, (typeof APPLE_ADS_CREDENTIALS)[number]>;

export function appleAdsEnabled(env: AppleAdsCredentials): boolean {
  return APPLE_ADS_CREDENTIALS.every((name) => Boolean(env[name]));
}

export function assertAppleAdsConfiguration(env: AppleAdsCredentials): void {
  const missing = APPLE_ADS_CREDENTIALS.filter((name) => !env[name]);
  if (missing.length > 0 && missing.length < APPLE_ADS_CREDENTIALS.length) {
    throw new Error(
      `Apple Ads is partly configured. Set ${missing.join(', ')} or remove every APPLE_ADS_ variable.`,
    );
  }
}
