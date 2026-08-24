import { completionBound, interleave } from './interleave';

const batchOf = (prefix: string, size: number): string[] =>
  Array.from({ length: size }, (_, index) => `${prefix}${index}`);

const lastPositionOf = (ordered: string[], prefix: string): number =>
  ordered.reduce(
    (last, job, index) => (job.startsWith(prefix) ? index : last),
    -1,
  );

describe('fair scheduling', () => {
  const indie = 50;
  const ultimate = 10_000;

  it('starts the small workspace in the first cycle', () => {
    const ordered = interleave([
      batchOf('big-', ultimate),
      batchOf('small-', indie),
    ]);

    expect(ordered.indexOf('small-0')).toBe(1);
  });

  it('completes a small workspace within its stated bound', () => {
    const sizes = [ultimate, indie];
    const ordered = interleave([
      batchOf('big-', sizes[0]),
      batchOf('small-', sizes[1]),
    ]);

    const finishedAt = lastPositionOf(ordered, 'small-') + 1;

    expect(finishedAt).toBeLessThanOrEqual(completionBound(sizes, 1));
    expect(completionBound(sizes, 1)).toBe(indie * 2);
  });

  it('holds the bound as more large workspaces arrive', () => {
    const sizes = [ultimate, ultimate, ultimate, indie];
    const ordered = interleave([
      batchOf('big1-', sizes[0]),
      batchOf('big2-', sizes[1]),
      batchOf('big3-', sizes[2]),
      batchOf('small-', sizes[3]),
    ]);

    expect(lastPositionOf(ordered, 'small-') + 1).toBeLessThanOrEqual(
      completionBound(sizes, 3),
    );
    expect(completionBound(sizes, 3)).toBe(indie * 4);
  });

  it('does not let a large workspace finish before a small one starts', () => {
    const ordered = interleave([
      batchOf('big-', ultimate),
      batchOf('small-', indie),
    ]);

    expect(lastPositionOf(ordered, 'small-')).toBeLessThan(
      lastPositionOf(ordered, 'big-'),
    );
  });

  it('shares equally per workspace rather than per keyword', () => {
    const ordered = interleave([
      batchOf('big-', ultimate),
      batchOf('small-', indie),
    ]).slice(0, indie * 2);

    expect(ordered.filter((job) => job.startsWith('small-'))).toHaveLength(
      indie,
    );
    expect(ordered.filter((job) => job.startsWith('big-'))).toHaveLength(indie);
  });

  it('bounds a workspace that has nothing to do at zero', () => {
    expect(completionBound([ultimate, 0], 1)).toBe(0);
  });
});
