import { AppSnapshot, Store } from '@prisma/client';
import { DiffableChangeSnapshot } from '../changes/change-detector';
import { screenshotKeys } from '../changes/screenshot-diff';
import {
  releaseNotesFor,
  screenshotsCount,
} from '../store-providers/raw-facts';

export function toChangeSnapshot(
  snapshot: AppSnapshot,
  iconUrl: string | null,
  store: Store,
): DiffableChangeSnapshot {
  return {
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    summary: snapshot.summary,
    description: snapshot.description,
    version: snapshot.version,
    price: snapshot.price,
    screenshotsCount: screenshotsCount(snapshot.raw),
    screenshots: screenshotKeys(store, snapshot.raw),
    iconUrl,
    releaseNotes: releaseNotesFor(store, snapshot.raw),
  };
}
