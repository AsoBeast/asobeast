import { OfficialPopularity } from './formulas';
import { officialEvidence, officialSignals } from './official-signals';
import {
  F10_ABSENT_CAP,
  F14_FLOOR_LISTED,
  F15_ABSENT_WITH_HISTORY,
  F16_LISTED_ABOVE_FLOOR,
  F9_OFFICIAL,
} from './scoring-fixtures';

const WEEK = '2026-10-18';

describe('official popularity state', () => {
  it('says nothing without an Apple answer', () => {
    expect(officialSignals(undefined)).toEqual({});
    expect(officialEvidence(undefined)).toEqual({});
  });

  it('names a term listed above the floor without a last listed value', () => {
    const signals = officialSignals(F16_LISTED_ABOVE_FLOOR.official);

    expect(officialEvidence(F16_LISTED_ABOVE_FLOOR.official)).toEqual({
      officialPopularityState: 'listed',
    });
    expect(signals).toEqual({
      officialPopularityState: 'listed',
      officialPopularityFloor: 56,
      officialPopularityWeek: WEEK,
    });
    expect(signals).not.toHaveProperty('officialPopularityLastAboveFloor');
  });

  it('names a term listed at the floor with every fact', () => {
    expect(officialSignals(F14_FLOOR_LISTED.official)).toEqual({
      officialPopularityState: 'floor',
      officialPopularityFloor: 41,
      officialPopularityWeek: WEEK,
      officialPopularityLastAboveFloor: { value: 63, week: '2026-09-06' },
    });
    expect(officialEvidence(F14_FLOOR_LISTED.official)).toEqual({
      officialPopularityState: 'floor',
    });
  });

  it('names a value below a stale floor a floor answer', () => {
    const official: OfficialPopularity = {
      value: 40,
      context: { week: WEEK, floor: 41, lastAboveFloor: null },
    };

    expect(officialEvidence(official)).toEqual({
      officialPopularityState: 'floor',
    });
  });

  it('names a term Apple left out with every fact', () => {
    expect(officialSignals(F15_ABSENT_WITH_HISTORY.official)).toEqual({
      officialPopularityState: 'absent',
      officialPopularityFloor: 41,
      officialPopularityWeek: WEEK,
      officialPopularityLastAboveFloor: { value: 58, week: '2026-09-27' },
    });
  });

  it('leaves out the last listed value when the kept weeks hold none', () => {
    const signals = officialSignals({
      absentBelow: 41,
      context: { week: WEEK, floor: 41, lastAboveFloor: null },
    });

    expect(signals).toEqual({
      officialPopularityState: 'absent',
      officialPopularityFloor: 41,
      officialPopularityWeek: WEEK,
    });
    expect(signals).not.toHaveProperty('officialPopularityLastAboveFloor');
  });

  it.each([
    ['a listed value', F9_OFFICIAL.official, 'listed'],
    ['an absent cap', F10_ABSENT_CAP.official, 'absent'],
  ])(
    'records only the state of %s without context',
    (_name, official, state) => {
      expect(officialSignals(official)).toEqual({
        officialPopularityState: state,
      });
    },
  );
});
