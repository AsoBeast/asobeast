import { Store } from '@prisma/client';

export interface PoolCandidate {
  endpointId: string;
  country: string | null;
  cooldownUntil: Date | null;
  pacedUntil: Date | null;
  lastUsedAt: Date | null;
}

export interface SelectionInput {
  candidates: PoolCandidate[];
  now: Date;
  minIntervalMs: number;
  country?: string;
  waitForLocal?: boolean;
}

export type Selection =
  | { kind: 'endpoint'; endpointId: string }
  | { kind: 'wait'; waitMs: number }
  | { kind: 'empty' };

export function isGeoSensitive(store: Store): boolean {
  return store === Store.GOOGLE_PLAY;
}

export function selectEndpoint({
  candidates,
  now,
  minIntervalMs,
  country,
  waitForLocal = true,
}: SelectionInput): Selection {
  if (candidates.length === 0) return { kind: 'empty' };

  const isAvailable = (candidate: PoolCandidate) =>
    availableAt(candidate, minIntervalMs) <= now.getTime();
  const local = country
    ? candidates.filter(
        (candidate) =>
          candidate.country === country && !coolingDown(candidate, now),
      )
    : [];
  const pool =
    local.length > 0 && (waitForLocal || local.some(isAvailable))
      ? local
      : candidates;

  const available = pool.filter(isAvailable);
  if (available.length === 0) {
    const earliest = Math.min(
      ...pool.map((candidate) => availableAt(candidate, minIntervalMs)),
    );
    return { kind: 'wait', waitMs: Math.max(earliest - now.getTime(), 0) };
  }

  return {
    kind: 'endpoint',
    endpointId: available.reduce(leastRecent).endpointId,
  };
}

export function availableAt(
  candidate: PoolCandidate,
  minIntervalMs: number,
): number {
  const cooldown = candidate.cooldownUntil?.getTime() ?? 0;
  const paced = candidate.pacedUntil?.getTime() ?? 0;
  const spacing = candidate.lastUsedAt
    ? candidate.lastUsedAt.getTime() + minIntervalMs
    : 0;
  return Math.max(cooldown, paced, spacing);
}

function coolingDown(candidate: PoolCandidate, now: Date): boolean {
  return (candidate.cooldownUntil?.getTime() ?? 0) > now.getTime();
}

function leastRecent(a: PoolCandidate, b: PoolCandidate): PoolCandidate {
  const left = a.lastUsedAt?.getTime() ?? 0;
  const right = b.lastUsedAt?.getTime() ?? 0;
  if (left !== right) return left < right ? a : b;
  return a.endpointId <= b.endpointId ? a : b;
}
