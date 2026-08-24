import {
  ACTION_ADVISORY_MAX_IMPACT,
  ACTION_ADVISORY_RULES,
  ActionRule,
} from '@asobeast/shared';
import { ImpactTerms, priorityFor, scoreImpact } from './action-impact';

const terms = (
  reach: number,
  severity: number,
  confidence: number,
): ImpactTerms => ({ reach, severity, confidence });

const flat = (value: number): ImpactTerms => terms(value, value, value);

const GROWTH: ActionRule = 'keyword.add_uncovered';
const ADVISORY: ActionRule = 'keyword.prune';

describe('scoreImpact', () => {
  it('returns 0 for all-zero terms and 100 for all-one terms', () => {
    expect(scoreImpact(GROWTH, flat(0))).toEqual({
      impact: 0,
      priority: 'low',
    });
    expect(scoreImpact(GROWTH, flat(1))).toEqual({
      impact: 100,
      priority: 'critical',
    });
  });

  it('weights reach, severity and confidence independently', () => {
    expect(scoreImpact(GROWTH, terms(1, 0, 0)).impact).toBe(45);
    expect(scoreImpact(GROWTH, terms(0, 1, 0)).impact).toBe(35);
    expect(scoreImpact(GROWTH, terms(0, 0, 1)).impact).toBe(20);
  });

  it('bands each boundary on the documented side', () => {
    const cases: Array<[number, string]> = [
      [0.34, 'low'],
      [0.35, 'medium'],
      [0.59, 'medium'],
      [0.6, 'high'],
      [0.79, 'high'],
      [0.8, 'critical'],
    ];

    for (const [value, priority] of cases) {
      const scored = scoreImpact(GROWTH, flat(value));
      expect(scored.impact).toBe(Math.round(value * 100));
      expect(scored.priority).toBe(priority);
    }
  });

  it('bands raw impact values at every boundary', () => {
    expect(priorityFor(34)).toBe('low');
    expect(priorityFor(35)).toBe('medium');
    expect(priorityFor(59)).toBe('medium');
    expect(priorityFor(60)).toBe('high');
    expect(priorityFor(79)).toBe('high');
    expect(priorityFor(80)).toBe('critical');
  });

  it('clamps advisory rules to the advisory ceiling', () => {
    for (const rule of ACTION_ADVISORY_RULES) {
      expect(scoreImpact(rule, flat(1))).toEqual({
        impact: ACTION_ADVISORY_MAX_IMPACT,
        priority: 'medium',
      });
    }
  });

  it('leaves an advisory rule below the ceiling untouched', () => {
    expect(scoreImpact(ADVISORY, flat(0.2)).impact).toBe(20);
  });

  it('clamps each term into the unit interval', () => {
    expect(scoreImpact(GROWTH, terms(5, -3, 2)).impact).toBe(
      scoreImpact(GROWTH, terms(1, 0, 1)).impact,
    );
  });

  it('throws rather than propagating a non-finite term', () => {
    expect(() => scoreImpact(GROWTH, terms(Number.NaN, 0, 0))).toThrow(/reach/);
    expect(() =>
      scoreImpact(GROWTH, terms(0, Number.POSITIVE_INFINITY, 0)),
    ).toThrow(/severity/);
    expect(() =>
      scoreImpact(GROWTH, terms(0, 0, Number.NEGATIVE_INFINITY)),
    ).toThrow(/confidence/);
  });
});
