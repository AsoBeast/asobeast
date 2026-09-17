import { keyword, playContext } from '../audit-context.fixture';
import { shortDescriptionChecks } from './metadata-checks';

const priority = [
  keyword('geo quiz', 'primary', 80),
  keyword('map game', 'secondary', 60),
];

const checkOf = (
  checks: ReturnType<typeof shortDescriptionChecks>,
  id: string,
) => checks.find((item) => item.id === id);

describe('shortDescriptionChecks', () => {
  it.each([
    ['', 0],
    ['x'.repeat(59), 6.9],
    ['x'.repeat(60), 7],
    ['x'.repeat(76), 7],
    ['x'.repeat(77), 10],
    ['x'.repeat(80), 10],
  ])(
    'scores a short description of %s characters on length',
    (summary, score) => {
      const checks = shortDescriptionChecks(
        playContext({ summary, keywords: priority }),
      );

      expect(checkOf(checks, 'short-description-length')?.score).toBe(score);
    },
  );

  it('names the priority keyword to add', () => {
    const checks = shortDescriptionChecks(
      playContext({
        summary: 'Travel the world from your sofa every day',
        keywords: priority,
      }),
    );
    const coverage = checkOf(checks, 'short-description-keyword');

    expect(coverage?.score).toBe(0);
    expect(coverage?.advice?.title).toBe(
      'Add “geo quiz” to your short description',
    );
  });

  it('fails a short description with a call to action', () => {
    const checks = shortDescriptionChecks(
      playContext({
        summary: 'Download now, the best geo quiz',
        keywords: priority,
      }),
    );

    expect(checkOf(checks, 'short-description-policy')?.status).toBe('fail');
  });

  it('scores a short description that covers two priority keywords', () => {
    const checks = shortDescriptionChecks(
      playContext({
        summary: 'A geo quiz and map game for curious travellers',
        keywords: priority,
      }),
    );

    expect(checkOf(checks, 'short-description-keyword')?.score).toBe(10);
  });

  it('waits for tracked keywords instead of scoring coverage', () => {
    const checks = shortDescriptionChecks(
      playContext({ summary: 'Travel the world from your sofa every day' }),
    );

    expect(checkOf(checks, 'short-description-keyword')).toMatchObject({
      score: null,
      status: 'unanswered',
      unlock: { kind: 'keywords' },
    });
  });

  it('omits the repetition and policy checks for an empty short description', () => {
    const ids = shortDescriptionChecks(playContext({ summary: '' })).map(
      (item) => item.id,
    );

    expect(ids).toEqual([
      'short-description-keyword',
      'short-description-length',
    ]);
  });
});
