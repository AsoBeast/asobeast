import { appRunStages } from './app-run-stages';

const counts = (
  listings: [number, number],
  keywords: [number, number],
  categories: [number, number],
) => ({
  listings: { ready: listings[0], total: listings[1] },
  keywords: { ready: keywords[0], total: keywords[1] },
  categories: { ready: categories[0], total: categories[1] },
});

describe('appRunStages', () => {
  it('answers the stages in contract order', () => {
    expect(
      appRunStages(counts([1, 2], [3, 4], [5, 6])).map((row) => row.stage),
    ).toEqual(['listings', 'keywords', 'categories']);
  });

  it('is complete once every count is in', () => {
    expect(appRunStages(counts([2, 2], [3, 4], [0, 1]))).toEqual([
      { stage: 'listings', ready: 2, total: 2, complete: true },
      { stage: 'keywords', ready: 3, total: 4, complete: false },
      { stage: 'categories', ready: 0, total: 1, complete: false },
    ]);
  });

  it('calls a stage with nothing to collect complete', () => {
    expect(appRunStages(counts([0, 0], [0, 0], [0, 0]))).toEqual([
      { stage: 'listings', ready: 0, total: 0, complete: true },
      { stage: 'keywords', ready: 0, total: 0, complete: true },
      { stage: 'categories', ready: 0, total: 0, complete: true },
    ]);
  });

  it('clamps ready to total', () => {
    expect(appRunStages(counts([3, 2], [0, 0], [4, 1]))).toEqual([
      { stage: 'listings', ready: 2, total: 2, complete: true },
      { stage: 'keywords', ready: 0, total: 0, complete: true },
      { stage: 'categories', ready: 1, total: 1, complete: true },
    ]);
  });
});
