import { searchKey } from '@asobeast/shared';
import { clamp } from './curves';

export type SuggestReach =
  | { status: 'hit'; prefixLength: number; position: number }
  | { status: 'listed'; position: number }
  | { status: 'absent' }
  | { status: 'unavailable' };

export const REACH_BY_PREFIX = [6.8, 4.8, 4.4, 4, 3.2, 2.5, 2, 1.6] as const;
export const REACH_LISTED = 1;
export const REACH_ABSENT = 0.9;
export const PREFIX_PROBE_CAP = REACH_BY_PREFIX.length;

export function reachScore(reach: SuggestReach): number | null {
  switch (reach.status) {
    case 'unavailable':
      return null;
    case 'absent':
      return REACH_ABSENT;
    case 'listed':
      return REACH_LISTED;
    case 'hit':
      return REACH_BY_PREFIX[
        clamp(Math.round(reach.prefixLength), 1, PREFIX_PROBE_CAP) - 1
      ];
  }
}

export function untypedShare(reach: SuggestReach, keyword: string): number {
  const length = Array.from(searchKey(keyword)).length;
  if (reach.status !== 'hit' || length === 0) {
    return 0;
  }
  return clamp(1 - reach.prefixLength / length, 0, 1);
}
