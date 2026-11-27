import { placementJudge, serpPlacement } from './serp-placement';

describe('serpPlacement', () => {
  it.each([
    ['focus timer', 'Focus Timer', 'Focus timer for study', 'both'],
    ['focus timer', 'Focus Timer Pro', 'Study better', 'title'],
    ['focus timer', 'Timer: Focus', null, 'title'],
    ['focus timer', 'Focus Timer', undefined, 'title'],
    ['habit tracker', 'Streaks', 'Habit tracker and planner', 'subtitle'],
    ['habit tracker', 'Habit Builder', 'Tracker for streaks', 'split'],
    ['habit tracker', 'Streaks', 'Daily goals', 'none'],
    ['habit tracker', 'Streaks', null, 'none'],
    ['habit tracker', 'Streaks', undefined, undefined],
    ['track', 'Tracker', 'Planner', 'none'],
    ['café finder', 'Cafe Finder', null, 'none'],
    ['集中タイマー', '勉強', '集中タイマーで勉強', 'subtitle'],
    ['운동', '매일 운동을 기록하세요', undefined, 'title'],
    ['', 'Focus Timer', 'Focus timer for study', undefined],
  ] as const)(
    'judges %j in %j with the subtitle %j as %j',
    (keyword, title, subtitle, expected) => {
      expect(serpPlacement(keyword, title, subtitle)).toBe(expected);
    },
  );
});

describe('serpPlacement on Google Play', () => {
  it.each([
    [
      'pomodoro timer',
      'Pomodoro Timer',
      'Pomodoro timer for study sessions',
      'both',
    ],
    ['pomodoro timer', 'Pomodoro Timer Pro', 'Stay focused', 'title'],
    [
      'pomodoro timer',
      'Focus Clock',
      'Stay on track with a pomodoro timer',
      'subtitle',
    ],
    ['pomodoro timer', 'Pomodoro Clock', 'A timer for deep work', 'split'],
    ['pomodoro timer', 'Focus Clock', 'Habit tracker with daily goals', 'none'],
    ['pomodoro timer', 'Pomodoro Timer', undefined, 'title'],
    ['pomodoro timer', 'Focus Clock', undefined, undefined],
    ['pomodoro timer', 'Focus Clock', null, 'none'],
    ['café', 'Focus Clock', 'Cafe time', 'none'],
    ['math music', 'Focus Clock', 'Math & Music', 'subtitle'],
    ['plan day', 'Focus Clock', 'Plan\nyour day', 'subtitle'],
    ['集中タイマー', '勉強', '集中タイマーで勉強', 'subtitle'],
    ['운동', '매일 기록', '매일 운동을 기록하세요', 'subtitle'],
  ] as const)(
    'judges %j in %j with the short description %j as %j',
    (keyword, title, shortDescription, expected) => {
      expect(serpPlacement(keyword, title, shortDescription)).toBe(expected);
    },
  );
});

describe('placementJudge', () => {
  it('answers the segments of the second field', () => {
    expect(
      placementJudge('habit tracker')('Habit Builder', 'Tracker for streaks'),
    ).toEqual({
      placement: 'split',
      secondSegments: [
        { text: 'Tracker', match: 'exact' },
        { text: ' for streaks', match: 'none' },
      ],
    });
  });

  it('answers the segments of a short description', () => {
    expect(
      placementJudge('pomodoro timer')(
        'Focus Clock',
        'Stay with a pomodoro timer',
      ),
    ).toEqual({
      placement: 'subtitle',
      secondSegments: [
        { text: 'Stay with a ', match: 'none' },
        { text: 'pomodoro', match: 'exact' },
        { text: ' ', match: 'none' },
        { text: 'timer', match: 'exact' },
      ],
    });
  });

  it('answers no subtitle segments when the subtitle is unknown or empty', () => {
    const judge = placementJudge('focus timer');

    expect(judge('Focus Timer', undefined)).toEqual({ placement: 'title' });
    expect(judge('Focus Timer', null)).toEqual({ placement: 'title' });
  });

  it('answers nothing for an unknown subtitle and a title without the keyword', () => {
    expect(placementJudge('habit tracker')('Streaks', undefined)).toEqual({});
  });
});
