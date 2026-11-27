import { Store } from '@prisma/client';
import { listingJudge } from './serp-listing-judge';

const row = (title: string, shortDescription: string | null = null) => ({
  storeAppId: 'a',
  title,
  shortDescription,
});

describe('listingJudge', () => {
  it('judges a Google Play row on its stored short description', () => {
    const judge = listingJudge(Store.GOOGLE_PLAY, 'habit tracker', new Map());

    expect(judge(row('Streaks', 'Habit tracker and planner'))).toEqual({
      placement: 'subtitle',
      shortDescription: 'Habit tracker and planner',
      shortDescriptionSegments: [
        { text: 'Habit', match: 'exact' },
        { text: ' ', match: 'none' },
        { text: 'tracker', match: 'exact' },
        { text: ' and planner', match: 'none' },
      ],
    });
  });

  it('reads a Google Play row without text as unknown', () => {
    const judge = listingJudge(Store.GOOGLE_PLAY, 'habit tracker', new Map());

    expect(judge(row('Streaks'))).toEqual({});
    expect(judge(row('Habit Tracker'))).toEqual({ placement: 'title' });
  });

  it('ignores the followed subtitles on Google Play', () => {
    const judge = listingJudge(
      Store.GOOGLE_PLAY,
      'habit tracker',
      new Map([['a', 'Habit tracker']]),
    );

    expect(judge(row('Streaks'))).toEqual({});
  });

  it('judges an App Store row on the followed subtitle', () => {
    const judge = listingJudge(
      Store.APP_STORE,
      'habit tracker',
      new Map([['a', 'Habit tracker and planner']]),
    );

    expect(judge(row('Streaks'))).toEqual({
      subtitle: 'Habit tracker and planner',
      placement: 'subtitle',
      subtitleSegments: [
        { text: 'Habit', match: 'exact' },
        { text: ' ', match: 'none' },
        { text: 'tracker', match: 'exact' },
        { text: ' and planner', match: 'none' },
      ],
    });
  });

  it('never answers a short description on the App Store', () => {
    const judge = listingJudge(Store.APP_STORE, 'habit tracker', new Map());

    expect(judge(row('Habit Tracker', 'Plan your day'))).toEqual({
      placement: 'title',
    });
  });
});
