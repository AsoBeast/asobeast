import type { Prisma } from '@prisma/client';
import {
  type AppStoreLocalization,
  isAppStoreLocalization,
} from '@asobeast/shared';
import { descriptionFingerprint } from './description-fingerprint';

export interface ConsoleListing {
  version: string | null;
  primary: AppStoreLocalization | null;
  fingerprints: ReadonlyMap<AppStoreLocalization, string>;
}

export interface StoredConsoleListing {
  version: string | null;
  primaryLocale: string | null;
  descriptionFingerprints: Prisma.JsonValue | null;
}

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function consoleListingOf(
  row: StoredConsoleListing | null,
): ConsoleListing | null {
  if (row === null || !isJsonObject(row.descriptionFingerprints)) return null;
  const fingerprints = new Map<AppStoreLocalization, string>();
  for (const [tag, print] of Object.entries(row.descriptionFingerprints)) {
    if (isAppStoreLocalization(tag) && typeof print === 'string') {
      fingerprints.set(tag, print);
    }
  }
  return {
    version: row.version,
    primary: isAppStoreLocalization(row.primaryLocale)
      ? row.primaryLocale
      : null,
    fingerprints,
  };
}

export function staleConsoleListing(
  listing: ConsoleListing | null,
  description: string,
  capturedVersion: string | null,
): boolean {
  if (listing === null || listing.fingerprints.size === 0) return false;
  if (listing.version === null || capturedVersion === null) return false;
  if (listing.version === capturedVersion) return false;
  const print = descriptionFingerprint(description);
  return ![...listing.fingerprints.values()].includes(print);
}
