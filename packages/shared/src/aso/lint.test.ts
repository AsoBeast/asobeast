import { describe, expect, it } from 'vitest';

import {
  lintDescription,
  lintKeywordField,
  lintShortDescription,
  lintSubtitle,
  lintTitle,
  LintIssue,
} from './lint';

const rules = (issues: LintIssue[]): string[] =>
  issues.map((issue) => issue.rule);

describe('lintTitle', () => {
  it('flags over-limit', () => {
    expect(rules(lintTitle('a'.repeat(31)))).toContain('over-limit');
    expect(rules(lintTitle('Habit Tracker & Daily Goals'))).not.toContain(
      'over-limit',
    );
  });

  it('flags under-utilized', () => {
    expect(rules(lintTitle('Notes'))).toContain('under-utilized');
    expect(rules(lintTitle('Habit Tracker Daily Goals'))).not.toContain(
      'under-utilized',
    );
  });

  it('flags special-characters', () => {
    expect(rules(lintTitle('Habit Tracker™'))).toContain('special-characters');
    expect(rules(lintTitle('Habit Tracker Pro'))).not.toContain(
      'special-characters',
    );
  });

  it('flags keyword-stuffing', () => {
    expect(rules(lintTitle('Habit Habit Tracker'))).toContain(
      'keyword-stuffing',
    );
    expect(rules(lintTitle('Habit Goal Tracker'))).not.toContain(
      'keyword-stuffing',
    );
  });
});

describe('lintSubtitle', () => {
  it('flags repeats-title-word', () => {
    const ctx = { titleWords: ['habit', 'tracker'] };
    expect(rules(lintSubtitle('Daily Habit Streaks', ctx))).toContain(
      'repeats-title-word',
    );
    expect(rules(lintSubtitle('Daily Streak Counter', ctx))).not.toContain(
      'repeats-title-word',
    );
  });
});

describe('lintShortDescription', () => {
  const ctx = {
    titleWords: ['habit', 'tracker'],
    trackedKeywords: ['daily streaks', 'water'],
  };

  it('returns no issues for an empty short description', () => {
    expect(lintShortDescription('')).toEqual([]);
  });

  it('flags over-limit', () => {
    expect(rules(lintShortDescription('a'.repeat(81)))).toContain('over-limit');
  });

  it('flags repeats-title-word', () => {
    expect(
      rules(
        lintShortDescription('Build a habit today with daily streaks', ctx),
      ),
    ).toContain('repeats-title-word');
  });

  it('flags no-tracked-keyword when none appear', () => {
    expect(
      rules(lintShortDescription('Reach your goals every single morning', ctx)),
    ).toContain('no-tracked-keyword');
    expect(
      rules(lintShortDescription('Build daily streaks and log water', ctx)),
    ).not.toContain('no-tracked-keyword');
  });

  it('is healthy when well utilized with a tracked keyword and no title repeat', () => {
    expect(
      rules(
        lintShortDescription(
          'Log water and build daily streaks to reach your goals faster now',
          ctx,
        ),
      ),
    ).toEqual([]);
  });
});

describe('lintKeywordField', () => {
  const base = { titleWords: ['habit'], subtitleWords: ['streak'] };

  it('flags repeats-title-word and repeats-subtitle-word', () => {
    const r = rules(lintKeywordField('habit,streak,water', base));
    expect(r).toContain('repeats-title-word');
    expect(r).toContain('repeats-subtitle-word');
    expect(rules(lintKeywordField('water,sleep,mood', base))).not.toContain(
      'repeats-title-word',
    );
  });

  it('flags space-after-comma', () => {
    expect(rules(lintKeywordField('water, sleep'))).toContain(
      'space-after-comma',
    );
    expect(rules(lintKeywordField('water,sleep'))).not.toContain(
      'space-after-comma',
    );
  });

  it('flags plural-form when the singular stem is present', () => {
    expect(rules(lintKeywordField('goal,goals,water'))).toContain(
      'plural-form',
    );
    expect(rules(lintKeywordField('goals,water,sleep'))).not.toContain(
      'plural-form',
    );
  });

  it('flags contains-generic-word', () => {
    expect(rules(lintKeywordField('app,tracker'))).toContain(
      'contains-generic-word',
    );
    expect(rules(lintKeywordField('tracker,planner'))).not.toContain(
      'contains-generic-word',
    );
  });

  it('flags contains-own-brand', () => {
    const ctx = { brandTokens: ['acme'] };
    expect(rules(lintKeywordField('acme,tracker', ctx))).toContain(
      'contains-own-brand',
    );
    expect(rules(lintKeywordField('water,tracker', ctx))).not.toContain(
      'contains-own-brand',
    );
  });

  it('flags contains-competitor-brand', () => {
    const ctx = { competitorNames: ['Duolingo'] };
    expect(rules(lintKeywordField('duolingo,learn', ctx))).toContain(
      'contains-competitor-brand',
    );
    expect(rules(lintKeywordField('spanish,learn', ctx))).not.toContain(
      'contains-competitor-brand',
    );
  });
});

describe('lintDescription', () => {
  it('flags weak-hook', () => {
    expect(rules(lintDescription('Welcome to Acme, track habits.'))).toContain(
      'weak-hook',
    );
    expect(
      rules(lintDescription('Track habits and reach goals.')),
    ).not.toContain('weak-hook');
  });

  it('flags no-cta', () => {
    expect(
      rules(lintDescription('A simple habit tracker for everyone.')),
    ).toContain('no-cta');
    expect(
      rules(lintDescription('Track habits. Download now to start today.')),
    ).not.toContain('no-cta');
  });

  it('flags no-social-proof', () => {
    expect(
      rules(lintDescription('Track your habits every single day.')),
    ).toContain('no-social-proof');
    expect(
      rules(lintDescription('Loved by 2 million users worldwide.')),
    ).not.toContain('no-social-proof');
  });

  it('flags no-formatting', () => {
    expect(
      rules(lintDescription('Track your habits every single day.')),
    ).toContain('no-formatting');
    expect(
      rules(lintDescription('Track habits.\n• Daily reminders')),
    ).not.toContain('no-formatting');
  });

  it('flags over-limit', () => {
    expect(rules(lintDescription('x'.repeat(4001)))).toContain('over-limit');
  });
});
