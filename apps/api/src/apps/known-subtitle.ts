import { NormalizedApp } from '../store-providers/types';

export function withKnownSubtitle(
  normalized: NormalizedApp,
  knownSubtitle: string | null,
): NormalizedApp {
  if (!normalized.subtitleUnavailable || knownSubtitle === null) {
    return normalized;
  }
  return { ...normalized, subtitle: knownSubtitle };
}
