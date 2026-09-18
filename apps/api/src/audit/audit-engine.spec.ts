import { gradeFor, scoreAudit, scoreFactor } from './audit-engine';

const scored = (weight: number, score: number | null) => ({ weight, score });

describe('scoreFactor', () => {
  it('weights checks and reports the scored share of weight', () => {
    expect(
      scoreFactor([
        scored(3, 10),
        scored(2, 7),
        scored(2, 10),
        scored(1, null),
      ]),
    ).toEqual({
      score: 9.1,
      confidence: 0.875,
    });
  });

  it('has no score and no confidence without a scored check', () => {
    expect(scoreFactor([scored(2, null)])).toEqual({
      score: null,
      confidence: 0,
    });
    expect(scoreFactor([])).toEqual({ score: null, confidence: 0 });
  });
});

describe('scoreAudit', () => {
  it('reproduces the worked example of the rubric', () => {
    const result = scoreAudit([
      { weight: 20, score: 9.1, confidence: 0.875, measurable: true },
      { weight: 15, score: 8, confidence: 2 / 7, measurable: true },
      { weight: 15, score: 5.2, confidence: 1, measurable: true },
    ]);

    expect(result).toEqual({
      overall: 73.8,
      confidence: 0.74,
      coveredWeight: 50,
      totalWeight: 50,
    });
  });

  it('moves the overall half as hard for a factor measured at half confidence', () => {
    const full = scoreAudit([
      { weight: 10, score: 10, confidence: 1, measurable: true },
      { weight: 10, score: 0, confidence: 1, measurable: true },
    ]);
    const half = scoreAudit([
      { weight: 10, score: 10, confidence: 1, measurable: true },
      { weight: 10, score: 0, confidence: 0.5, measurable: true },
    ]);

    expect(full.overall).toBe(50);
    expect(half.overall).toBe(66.7);
  });

  it('keeps a not measurable factor out of confidence but in totalWeight', () => {
    const result = scoreAudit([
      { weight: 20, score: 8, confidence: 1, measurable: true },
      { weight: 5, score: null, confidence: 0, measurable: false },
    ]);

    expect(result).toEqual({
      overall: 80,
      confidence: 1,
      coveredWeight: 20,
      totalWeight: 25,
    });
  });

  it('has no overall when nothing is scored', () => {
    expect(
      scoreAudit([
        { weight: 20, score: null, confidence: 0, measurable: true },
      ]),
    ).toEqual({
      overall: null,
      confidence: 0,
      coveredWeight: 0,
      totalWeight: 20,
    });
  });
});

describe('gradeFor', () => {
  it.each([
    [null, null],
    [0, 'F'],
    [29.9, 'F'],
    [30, 'D'],
    [49.9, 'D'],
    [50, 'C'],
    [69.9, 'C'],
    [70, 'B'],
    [84.9, 'B'],
    [85, 'A'],
    [100, 'A'],
  ])('grades %s as %s', (overall, grade) => {
    expect(gradeFor(overall)).toBe(grade);
  });
});
