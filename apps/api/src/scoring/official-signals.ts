import { OfficialPopularityState, ScoreSignals } from '@asobeast/shared';
import { OfficialPopularity } from './formulas';

type OfficialSignals = Pick<
  ScoreSignals,
  | 'officialPopularityState'
  | 'officialPopularityFloor'
  | 'officialPopularityWeek'
  | 'officialPopularityLastAboveFloor'
>;

function stateOf(official: OfficialPopularity): OfficialPopularityState {
  if ('absentBelow' in official) {
    return 'absent';
  }
  const floor = official.context?.floor;
  return floor !== undefined && official.value <= floor ? 'floor' : 'listed';
}

export const officialPopularityState = (
  official: OfficialPopularity | undefined,
): OfficialPopularityState | null => (official ? stateOf(official) : null);

export function officialSignals(
  official: OfficialPopularity | undefined,
): OfficialSignals {
  if (!official) {
    return {};
  }
  const { context } = official;
  return {
    officialPopularityState: stateOf(official),
    ...(context
      ? {
          officialPopularityFloor: context.floor,
          officialPopularityWeek: context.week,
          ...(context.lastAboveFloor
            ? { officialPopularityLastAboveFloor: context.lastAboveFloor }
            : {}),
        }
      : {}),
  };
}

export const officialEvidence = (
  official: OfficialPopularity | undefined,
): { officialPopularityState?: OfficialPopularityState } =>
  official ? { officialPopularityState: stateOf(official) } : {};
