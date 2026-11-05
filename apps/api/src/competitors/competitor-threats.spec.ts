import {
  CheckSeries,
  overtookOn,
  Rival,
  strongestThreat,
} from './competitor-threats';

const TODAY = '2026-11-03';
const SINCE = '2026-10-27';

const series = (...checks: [string, number | null][]): CheckSeries =>
  checks.map(([date, position]) => ({ date, position }));

const rival = (id: string, ...checks: [string, number | null][]): Rival => ({
  id,
  series: series(...checks),
});

const threatOf = (you: CheckSeries, ...rivals: Rival[]) =>
  strongestThreat({ you, rivals, today: TODAY });

describe('overtookOn', () => {
  it('dates a pass on the later check', () => {
    expect(
      overtookOn(
        series(['2026-11-03', 12], ['2026-11-02', 9]),
        series(['2026-11-03', 8], ['2026-11-02', 10]),
        SINCE,
      ),
    ).toBe('2026-11-03');
  });

  it('counts a pass on the first day of the window', () => {
    expect(
      overtookOn(
        series(['2026-10-27', 12], ['2026-10-26', 9]),
        series(['2026-10-27', 8], ['2026-10-26', 10]),
        SINCE,
      ),
    ).toBe('2026-10-27');
  });

  it('ignores a pass one day before the window', () => {
    expect(
      overtookOn(
        series(['2026-10-26', 12], ['2026-10-25', 9]),
        series(['2026-10-26', 8], ['2026-10-25', 10]),
        SINCE,
      ),
    ).toBeNull();
  });

  it('dates a pass the app later took back', () => {
    expect(
      overtookOn(
        series(['2026-11-03', 7], ['2026-11-02', 12], ['2026-11-01', 9]),
        series(['2026-11-03', 8], ['2026-11-02', 8], ['2026-11-01', 10]),
        SINCE,
      ),
    ).toBe('2026-11-02');
  });

  it('finds nothing when the app was never ahead', () => {
    expect(
      overtookOn(
        series(['2026-11-03', 12], ['2026-11-02', 11]),
        series(['2026-11-03', 3], ['2026-11-02', 4]),
        SINCE,
      ),
    ).toBeNull();
  });

  it('finds nothing when the app was unranked before', () => {
    expect(
      overtookOn(
        series(['2026-11-03', 12], ['2026-11-02', null]),
        series(['2026-11-03', 8], ['2026-11-02', 12]),
        SINCE,
      ),
    ).toBeNull();
  });

  it('counts a competitor that entered above the app', () => {
    expect(
      overtookOn(
        series(['2026-11-03', 12], ['2026-11-02', 9]),
        series(['2026-11-03', 8], ['2026-11-02', null]),
        SINCE,
      ),
    ).toBe('2026-11-03');
  });

  it('needs the competitor checked on both days', () => {
    expect(
      overtookOn(
        series(['2026-11-03', 12], ['2026-11-02', 9]),
        series(['2026-11-03', 8]),
        SINCE,
      ),
    ).toBeNull();
  });

  it('needs two checks of the app', () => {
    expect(
      overtookOn(series(['2026-11-03', 12]), series(['2026-11-03', 8]), SINCE),
    ).toBeNull();
  });

  it('answers the newer of two passes', () => {
    expect(
      overtookOn(
        series(
          ['2026-11-03', 12],
          ['2026-11-02', 6],
          ['2026-11-01', 12],
          ['2026-10-31', 6],
        ),
        series(
          ['2026-11-03', 8],
          ['2026-11-02', 9],
          ['2026-11-01', 8],
          ['2026-10-31', 9],
        ),
        SINCE,
      ),
    ).toBe('2026-11-03');
  });
});

describe('strongestThreat', () => {
  const you = (position: number | null, date = TODAY) =>
    series([date, position], ['2026-11-02', position]);

  it('counts the app at 30 with a competitor one below that rose', () => {
    expect(
      threatOf(you(30), rival('a', [TODAY, 31], ['2026-11-02', 33])),
    ).toMatchObject({ kind: 'closing', competitorPosition: 31 });
  });

  it('ignores the app at 31', () => {
    expect(
      threatOf(you(31), rival('a', [TODAY, 32], ['2026-11-02', 34])),
    ).toBeNull();
  });

  it('answers how far a closing competitor rose', () => {
    expect(threatOf(you(5), rival('a', [TODAY, 8], ['2026-11-02', 9]))).toEqual(
      {
        kind: 'closing',
        competitorId: 'a',
        competitorPosition: 8,
        competitorDelta: 1,
        overtookOn: null,
      },
    );
  });

  it.each([
    ['four below and rising', 9, 12],
    ['three below and holding', 8, 8],
    ['two below and falling', 7, 6],
  ])('ignores a competitor %s', (_, now, before) => {
    expect(
      threatOf(you(5), rival('a', [TODAY, now], ['2026-11-02', before])),
    ).toBeNull();
  });

  it('counts a competitor that entered two below the app', () => {
    expect(
      threatOf(you(5), rival('a', [TODAY, 7], ['2026-11-02', null])),
    ).toMatchObject({ kind: 'closing', competitorDelta: null });
  });

  it('ignores a closing competitor with no earlier check', () => {
    expect(threatOf(you(5), rival('a', [TODAY, 7]))).toBeNull();
  });

  it('answers a competitor that overtook the app', () => {
    expect(
      threatOf(
        series([TODAY, 9], ['2026-11-02', 9], ['2026-10-31', 4]),
        rival('a', [TODAY, 6], ['2026-11-02', 7], ['2026-10-31', 8]),
      ),
    ).toEqual({
      kind: 'overtook',
      competitorId: 'a',
      competitorPosition: 6,
      competitorDelta: 1,
      overtookOn: '2026-11-02',
    });
  });

  it('ignores a competitor that was always ahead', () => {
    expect(
      threatOf(you(9), rival('a', [TODAY, 3], ['2026-11-02', 3])),
    ).toBeNull();
  });

  it('never answers an overtake the app took back', () => {
    const threat = threatOf(
      series([TODAY, 6], ['2026-11-02', 9], ['2026-11-01', 5]),
      rival('a', [TODAY, 8], ['2026-11-02', 7], ['2026-11-01', 6]),
    );

    expect(threat?.kind).not.toBe('overtook');
  });

  it('ignores a stale check of the app', () => {
    expect(
      threatOf(
        series(['2026-11-01', 5], ['2026-10-31', 5]),
        rival('a', [TODAY, 7], ['2026-11-02', 9]),
      ),
    ).toBeNull();
  });

  it('ignores a stale competitor and keeps a fresh one', () => {
    expect(
      threatOf(
        you(5),
        rival('stale', ['2026-11-01', 6], ['2026-10-31', 9]),
        rival('fresh', [TODAY, 7], ['2026-11-02', 9]),
      )?.competitorId,
    ).toBe('fresh');
  });

  it('ignores a competitor with no checks', () => {
    expect(threatOf(you(5), rival('a'))).toBeNull();
  });

  it('ranks an overtake above a closing competitor', () => {
    expect(
      threatOf(
        series([TODAY, 9], ['2026-11-02', 5]),
        rival('closing', [TODAY, 10], ['2026-11-02', 14]),
        rival('passed', [TODAY, 7], ['2026-11-02', 8]),
      )?.competitorId,
    ).toBe('passed');
  });

  it('ranks the later of two overtakes, then the better position', () => {
    const app = series([TODAY, 9], ['2026-11-02', 9], ['2026-11-01', 5]);

    expect(
      threatOf(
        app,
        rival('older', [TODAY, 2], ['2026-11-02', 3], ['2026-11-01', 8]),
        rival('newer', [TODAY, 7], ['2026-11-02', 10], ['2026-11-01', 8]),
      )?.competitorId,
    ).toBe('newer');
    expect(
      threatOf(
        app,
        rival('worse', [TODAY, 7], ['2026-11-02', 10], ['2026-11-01', 8]),
        rival('better', [TODAY, 6], ['2026-11-02', 11], ['2026-11-01', 8]),
      )?.competitorId,
    ).toBe('better');
  });

  it('ranks the closest closing competitor, then the biggest rise', () => {
    expect(
      threatOf(
        you(5),
        rival('far', [TODAY, 8], ['2026-11-02', 20]),
        rival('near', [TODAY, 6], ['2026-11-02', 7]),
      )?.competitorId,
    ).toBe('near');
    expect(
      threatOf(
        you(5),
        rival('entered', [TODAY, 7], ['2026-11-02', null]),
        rival('small', [TODAY, 7], ['2026-11-02', 8]),
        rival('big', [TODAY, 7], ['2026-11-02', 12]),
      )?.competitorId,
    ).toBe('big');
    expect(
      threatOf(
        you(5),
        rival('first', [TODAY, 7], ['2026-11-02', 8]),
        rival('second', [TODAY, 7], ['2026-11-02', 8]),
      )?.competitorId,
    ).toBe('first');
  });
});
