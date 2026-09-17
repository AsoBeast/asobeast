import { KeywordComparisonRow } from '@asobeast/shared';
import { appStoreContext, competitor, keyword } from '../audit-context.fixture';
import { rankingChecks } from './visibility-checks';

const checkOf = (checks: ReturnType<typeof rankingChecks>, id: string) =>
  checks.find((item) => item.id === id);

const rival = competitor({ id: 'rival', name: 'Rival' });

const row = (
  keywordId: string,
  you: number | null,
  theirs: number | null,
): KeywordComparisonRow => ({
  keywordId,
  text: keywordId,
  traffic: null,
  difficulty: null,
  you,
  positions: { rival: theirs },
  gap: theirs !== null && theirs <= 10 && (you === null || you > theirs),
});

const comparisonOf = (rows: KeywordComparisonRow[]) => ({
  competitors: [{ id: 'rival', name: 'Rival' }],
  rows,
});

const trafficKeyword = (text: string, traffic: number) =>
  keyword(text, 'primary', 50, { traffic });

describe('rankings-visibility', () => {
  it.each([
    [0, 0],
    [24.9, 5],
    [25, 5],
    [50, 10],
    [80, 10],
  ])('scores visibility %s as %s', (latest, score) => {
    const checks = rankingChecks(
      appStoreContext({
        visibility: { latest, latestDate: '2026-09-17', weekAgo: null },
      }),
    );

    expect(checkOf(checks, 'rankings-visibility')?.score).toBe(score);
  });

  it('waits for the first daily check', () => {
    const checks = rankingChecks(appStoreContext());

    expect(checkOf(checks, 'rankings-visibility')).toMatchObject({
      score: null,
      unlock: {
        kind: 'history',
        label: 'Positions appear after the first daily check',
      },
    });
  });
});

describe('rankings-trend', () => {
  it.each([
    [-10, 0],
    [-9.9, 3],
    [-2, 3],
    [-1.9, 7],
    [1.9, 7],
    [2, 10],
  ])('scores a 7 day visibility change of %s as %s', (delta, score) => {
    const checks = rankingChecks(
      appStoreContext({
        visibility: {
          latest: 40 + delta,
          latestDate: '2026-09-17',
          weekAgo: 40,
        },
      }),
    );

    expect(checkOf(checks, 'rankings-trend')?.score).toBe(score);
  });

  it('waits for a week of history', () => {
    const checks = rankingChecks(
      appStoreContext({
        visibility: { latest: 40, latestDate: '2026-09-17', weekAgo: null },
      }),
    );

    expect(checkOf(checks, 'rankings-trend')).toMatchObject({
      score: null,
      unlock: { kind: 'history', label: 'Needs 7 days of position history' },
    });
  });
});

describe('rankings-top10', () => {
  it.each([
    [[null, null, null, null], 0],
    [[4, null, null, null], 5],
    [[4, 8, null, null], 10],
    [[4, 8, 2, 1], 10],
  ])('scores %j priority positions as %s', (positions, score) => {
    const keywords = positions.map((position, index) =>
      keyword(`k${index}`, 'primary', 90 - index, { position }),
    );

    expect(
      checkOf(rankingChecks(appStoreContext({ keywords })), 'rankings-top10')
        ?.score,
    ).toBe(score);
  });

  it('waits for priority keywords', () => {
    expect(
      checkOf(rankingChecks(appStoreContext()), 'rankings-top10'),
    ).toMatchObject({ score: null, unlock: { kind: 'keywords' } });
  });
});

describe('rankings-competitor-gap', () => {
  const rows = [
    row('k1', null, 3),
    row('k2', 2, 9),
    row('k3', 4, 20),
    row('k4', 1, null),
  ];

  it('never passes the competitor gap without competitors', () => {
    const checks = rankingChecks(
      appStoreContext({
        competitors: [],
        comparison: { competitors: [], rows: [] },
      }),
    );

    expect(checkOf(checks, 'rankings-competitor-gap')).toMatchObject({
      score: null,
      status: 'unanswered',
      unlock: {
        kind: 'competitors',
        label: 'Add competitors to find keyword gaps',
      },
    });
  });

  it('weights gaps by traffic', () => {
    const keywords = [
      trafficKeyword('k1', 9),
      trafficKeyword('k2', 1),
      trafficKeyword('k3', 1),
      trafficKeyword('k4', 1),
    ];

    expect(
      checkOf(
        rankingChecks(
          appStoreContext({
            keywords,
            comparison: comparisonOf(rows),
            competitors: [rival],
          }),
        ),
        'rankings-competitor-gap',
      )?.score,
    ).toBe(0);
  });

  it('scores the same gaps at equal traffic as a quarter share', () => {
    const keywords = ['k1', 'k2', 'k3', 'k4'].map((text) =>
      trafficKeyword(text, 1),
    );

    expect(
      checkOf(
        rankingChecks(
          appStoreContext({
            keywords,
            comparison: comparisonOf(rows),
            competitors: [rival],
          }),
        ),
        'rankings-competitor-gap',
      )?.score,
    ).toBe(5);
  });
});
