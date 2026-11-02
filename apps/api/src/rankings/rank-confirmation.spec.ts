import { RANK_DEPTH, RankMilestoneTier } from '@asobeast/shared';
import {
  confirmedDrop,
  confirmedExit,
  ConfirmationWindow,
  Position,
  undoesDrop,
  undoesExit,
} from './rank-confirmation';

const windowOf = (sequence: Position[], threshold = 5): ConfirmationWindow => ({
  checks: sequence
    .slice(0, -1)
    .reverse()
    .slice(0, 3)
    .map((position) => ({ position, depth: RANK_DEPTH })),
  today: sequence[sequence.length - 1],
  threshold,
});

describe('confirmedDrop', () => {
  it.each<{
    name: string;
    sequence: Position[];
    expected: number | null;
    threshold?: number;
  }>([
    {
      name: 'one day wobble of a threshold drop',
      sequence: [9, 15, 9],
      expected: null,
    },
    { name: 'a drop that holds', sequence: [9, 15, 15], expected: 9 },
    { name: 'a drop that deepens', sequence: [9, 15, 21], expected: 9 },
    {
      name: 'held at exactly the threshold',
      sequence: [9, 15, 14],
      expected: 9,
    },
    {
      name: 'partly recovered below the threshold',
      sequence: [9, 15, 13],
      expected: null,
    },
    {
      name: 'the first step was below the threshold',
      sequence: [9, 11, 12],
      expected: null,
    },
    {
      name: 'a lower threshold counts the first step',
      sequence: [9, 12, 12],
      expected: 9,
      threshold: 3,
    },
    {
      name: 'not found on the second check',
      sequence: [9, null, null],
      expected: 9,
    },
    { name: 'not found, then back', sequence: [9, null, 9], expected: null },
    {
      name: 'not found at the start is no drop',
      sequence: [null, 15, 15],
      expected: null,
    },
    { name: 'the first check of a keyword', sequence: [9], expected: null },
    {
      name: 'the second check of a keyword',
      sequence: [9, 15],
      expected: null,
    },
    {
      name: 'a confirmed drop settles, no second report',
      sequence: [9, 15, 21, 21],
      expected: null,
    },
    {
      name: 'a confirmed drop keeps falling, no double report',
      sequence: [9, 15, 21, 30],
      expected: null,
    },
    {
      name: 'a long slide stays reported once',
      sequence: [9, 15, 21, 30, 40],
      expected: null,
    },
    {
      name: 'partial recovery of a drop still down',
      sequence: [9, 20, 15],
      expected: 9,
    },
    {
      name: 'a new drop after a quiet check is its own report',
      sequence: [9, 15, 15, 30, 30],
      expected: 15,
    },
    {
      name: 'a later fall after an exit report is its own report',
      sequence: [9, 11, 12, 20, 21],
      expected: 12,
    },
  ])('$name', ({ sequence, expected, threshold }) => {
    expect(confirmedDrop(windowOf(sequence, threshold))).toEqual(
      expected === null ? null : { from: expected, fromDepth: RANK_DEPTH },
    );
  });
});

describe('confirmedExit', () => {
  it.each<[string, Position[], [RankMilestoneTier, number] | null]>([
    ['a one day wobble across the top 10', [9, 11, 9], null],
    ['a leave that holds', [9, 11, 12], [10, 9]],
    ['a leave that deepens', [9, 11, 20], [10, 9]],
    ['a leave then not found', [9, 11, null], [10, 9]],
    ['the top 3', [2, 5, 6], [3, 2]],
    ['first place', [1, 2, 2], [1, 1]],
    ['the broadest tier that holds is reported', [2, 11, 5], [3, 2]],
    ['leaves the top 3 and the top 10, back to the top 3', [2, 11, 2], null],
    ['a leave then re-entry', [9, 11, 8], null],
    ['a leave after an entry', [12, 9, 11, 12], [10, 9]],
    ['a drop that crosses two tiers reports the broader', [3, 9, 20], [3, 3]],
    ['a leave that sits still is reported once', [9, 11, 11, 11], null],
    ['a slow slide outside the tier', [9, 11, 13, 15, 17], null],
    ['not a drop and an exit in one move', [9, 15, 15], [10, 9]],
    ['the first check', [9], null],
    ['the second check', [9, 12], null],
  ])('%s', (_, sequence, expected) => {
    expect(confirmedExit(windowOf(sequence))).toEqual(
      expected === null
        ? null
        : { tier: expected[0], from: expected[1], fromDepth: RANK_DEPTH },
    );
  });
});

describe('undoesDrop', () => {
  it.each<[string, Position[], boolean]>([
    ['the drop was one day old and recovers', [9, 15, 9], true],
    ['not found and back', [9, null, 9], true],
    ['a partial recovery of a pending drop', [9, 20, 15], true],
    ['the step before was no drop', [9, 11, 9], false],
    [
      'the fall was already reported, the recovery is real news',
      [9, 15, 21, 16],
      false,
    ],
    [
      'an exit already reported blocks the drop kind too',
      [9, 11, 20, 15],
      false,
    ],
    ['nothing happened', [9, 9, 9], false],
    ['a rise past where the pending drop began', [20, 30, 8], false],
    ['a return from not found far above the start', [50, null, 8], false],
  ])('%s', (_, sequence, expected) => {
    expect(undoesDrop(windowOf(sequence))).toBe(expected);
  });
});

describe('undoesExit', () => {
  it.each<[string, Position[], RankMilestoneTier, boolean]>([
    ['back in the top 10 after one day out', [9, 11, 9], 10, true],
    ['back in the top 10 after a threshold drop', [9, 15, 9], 10, true],
    ['back in the top 3', [2, 11, 2], 3, true],
    [
      'back in the top 10 while the top 3 stays confirmed out',
      [2, 11, 5],
      10,
      true,
    ],
    ['the top 3 pending in the same move', [2, 11, 5], 3, true],
    ['first place never left', [2, 11, 5], 1, false],
    ['exit already reported', [9, 11, 20, 15], 10, false],
  ])('%s', (_, sequence, tier, expected) => {
    expect(undoesExit(windowOf(sequence), tier)).toBe(expected);
  });
});
