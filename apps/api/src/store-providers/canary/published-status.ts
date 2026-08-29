import { STORES, type Store } from '@asobeast/shared';
import { z } from 'zod';

export const PUBLISHED_STATUS_SCHEMA_VERSION = 1;

export const PUBLISHED_SUMMARY_MAX = 280;

export interface PublishedStoreStatus {
  state: 'ok' | 'broken';
  since: string | null;
  summary: string | null;
}

const publishedDocument = z.object({
  schemaVersion: z.literal(PUBLISHED_STATUS_SCHEMA_VERSION),
  stores: z.record(z.string(), z.unknown()),
});

const publishedStoreStatus = z
  .object({
    state: z.enum(['ok', 'broken']),
    since: z.unknown().optional(),
    summary: z.unknown().optional(),
  })
  .transform((raw): PublishedStoreStatus => ({
    state: raw.state,
    since: isoOrNull(raw.since),
    summary: cappedTextOrNull(raw.summary),
  }));

export function parsePublishedStatus(
  input: unknown,
): Partial<Record<Store, PublishedStoreStatus>> | null {
  const document = publishedDocument.safeParse(input);
  if (!document.success) return null;

  const statuses: Partial<Record<Store, PublishedStoreStatus>> = {};
  for (const store of STORES) {
    const status = publishedStoreStatus.safeParse(document.data.stores[store]);
    if (status.success) statuses[store] = status.data;
  }
  return statuses;
}

const UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value)) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function cappedTextOrNull(value: unknown): string | null {
  return typeof value === 'string'
    ? value.slice(0, PUBLISHED_SUMMARY_MAX)
    : null;
}
