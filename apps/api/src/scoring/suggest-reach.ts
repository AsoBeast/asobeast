import { clamp } from './curves';

export type SuggestReach =
  | { status: 'hit'; prefixLength: number; position: number }
  | { status: 'listed'; position: number }
  | { status: 'absent' }
  | { status: 'unavailable' };

export const REACH_BY_PREFIX = [10, 9, 7.8, 6.6, 5.4, 4.2, 3.2, 2.4] as const;
export const REACH_POSITION_DECAY = 0.03;
export const REACH_LISTED = 1.5;
export const PREFIX_PROBE_CAP = REACH_BY_PREFIX.length;

export function reachScore(reach: SuggestReach): number | null {
  switch (reach.status) {
    case 'unavailable':
      return null;
    case 'absent':
      return 0;
    case 'listed':
      return REACH_LISTED;
    case 'hit': {
      const index =
        clamp(Math.round(reach.prefixLength), 1, PREFIX_PROBE_CAP) - 1;
      const position = Math.max(1, reach.position);
      return clamp(
        REACH_BY_PREFIX[index] * (1 - REACH_POSITION_DECAY * (position - 1)),
      );
    }
  }
}
