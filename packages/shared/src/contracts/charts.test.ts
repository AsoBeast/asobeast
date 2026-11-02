import { describe, expect, it } from 'vitest';
import { OVERALL_GENRE } from './category-ranks';
import { WEBHOOK_EVENTS } from './changes';
import {
  CHART_COLLECTION_TITLES,
  CHART_COMPARE_WINDOWS,
  CHART_DEPTH,
  CHART_MOVE_EVENTS,
  chartColumnsPath,
  chartDevicesOf,
  chartGenreName,
  chartGenresOf,
  chartTablePath,
  compareDays,
  defaultChartDevice,
  isChartGenre,
  isChartMovePayload,
} from './charts';

describe('chart devices', () => {
  it('lists one device per store today', () => {
    expect(chartDevicesOf('APP_STORE')).toEqual(['iphone']);
    expect(chartDevicesOf('GOOGLE_PLAY')).toEqual(['android']);
    expect(defaultChartDevice('APP_STORE')).toBe('iphone');
    expect(defaultChartDevice('GOOGLE_PLAY')).toBe('android');
  });

  it('caps the depth per store', () => {
    expect(CHART_DEPTH.APP_STORE).toBe(100);
    expect(CHART_DEPTH.GOOGLE_PLAY).toBe(200);
  });
});

describe('chart genres', () => {
  it('lists the App Store genres Apple charts', () => {
    const genres = chartGenresOf('APP_STORE');
    const ids = genres.map((genre) => genre.id);
    const games = genres.filter((genre) => genre.group === 'games');
    const apps = genres.filter(
      (genre) => genre.group === 'apps' && genre.id !== OVERALL_GENRE,
    );

    expect(genres).toHaveLength(42);
    expect(genres[0].id).toBe(OVERALL_GENRE);
    expect(new Set(ids).size).toBe(ids.length);
    expect(games).toHaveLength(16);
    expect(games.every((genre) => genre.id.startsWith('70'))).toBe(true);
    expect(apps).toHaveLength(25);
    expect(ids).toEqual(expect.arrayContaining(['6026', '6027']));
    expect(genres.find((genre) => genre.id === '7003')?.name).toBe('Casual');
    expect(genres.some((genre) => genre.name === 'Arcade')).toBe(false);
    for (const gone of ['6022', '6025', '7007', '7008', '7010']) {
      expect(ids).not.toContain(gone);
    }
  });

  it('lists the Google Play categories', () => {
    const genres = chartGenresOf('GOOGLE_PLAY');
    const ids = genres.map((genre) => genre.id);
    const games = genres
      .filter((genre) => genre.group === 'games')
      .map((genre) => genre.id);

    expect(ids[0]).toBe(OVERALL_GENRE);
    expect(new Set(ids).size).toBe(ids.length);
    expect(games).toContain('GAME');
    expect(games.filter((id) => id.startsWith('GAME_'))).toHaveLength(17);
    expect(genres.find((genre) => genre.id === 'FAMILY')?.group).toBe('family');
    expect(ids.some((id) => id.startsWith('FAMILY_'))).toBe(false);
    expect(ids).not.toContain('APPLICATION');
  });

  it('answers a genre name', () => {
    expect(chartGenreName('APP_STORE', '6014')).toBe('Games');
    expect(chartGenreName('APP_STORE', OVERALL_GENRE)).toBe('Overall');
    expect(chartGenreName('GOOGLE_PLAY', 'GAME_PUZZLE')).toBe('Puzzle');
    expect(chartGenreName('APP_STORE', '9999')).toBeNull();
  });

  it('accepts only a listed genre', () => {
    expect(isChartGenre('APP_STORE', '6014')).toBe(true);
    expect(isChartGenre('APP_STORE', 'GAME')).toBe(false);
    expect(isChartGenre('GOOGLE_PLAY', 'overall')).toBe(true);
    expect(isChartGenre('GOOGLE_PLAY', 'FAMILY_ACTION')).toBe(false);
  });
});

describe('chart compare windows', () => {
  it('bounds the compare windows', () => {
    expect(CHART_COMPARE_WINDOWS).toEqual(['1d', '7d', '30d']);
    expect(compareDays('1d')).toBe(1);
    expect(compareDays('7d')).toBe(7);
    expect(compareDays('30d')).toBe(30);
  });
});

describe('chart page paths', () => {
  const puzzle = {
    store: 'GOOGLE_PLAY',
    country: 'de',
    collection: 'paid',
    genre: 'GAME_PUZZLE',
    device: 'android',
  } as const;
  const puzzleTable =
    '/charts?store=GOOGLE_PLAY&country=de&genre=GAME_PUZZLE&device=android&view=table&collection=paid';

  it('links the columns of a category', () => {
    expect(
      chartColumnsPath({
        store: 'APP_STORE',
        country: 'us',
        genre: '6014',
        device: 'iphone',
      }),
    ).toBe('/charts?store=APP_STORE&country=us&genre=6014&device=iphone');
  });

  it('links the table of one chart kind', () => {
    expect(chartTablePath(puzzle)).toBe(puzzleTable);
  });

  it('adds a compare window and a day when given', () => {
    expect(chartTablePath(puzzle, { compare: '7d', date: '2026-10-13' })).toBe(
      `${puzzleTable}&compare=7d&date=2026-10-13`,
    );
  });

  it('leaves out the default compare window and an empty day', () => {
    expect(chartTablePath(puzzle, { compare: '1d', date: null })).toBe(
      chartTablePath(puzzle),
    );
  });

  it('titles every chart kind', () => {
    expect(CHART_COLLECTION_TITLES).toEqual({
      free: 'Top free',
      paid: 'Top paid',
      grossing: 'Top grossing',
    });
  });
});

describe('chart move events', () => {
  it.each(['chart.entered', 'chart.left', 'chart.milestone'])(
    'recognises %s as a chart move',
    (event) => {
      expect(isChartMovePayload({ event })).toBe(true);
    },
  );

  it.each(['rank.milestone', 'alerts.batch'])(
    'refuses %s as a chart move',
    (event) => {
      expect(isChartMovePayload({ event })).toBe(false);
    },
  );

  it('names only webhook events', () => {
    const events: readonly string[] = WEBHOOK_EVENTS;

    expect(CHART_MOVE_EVENTS.every((event) => events.includes(event))).toBe(
      true,
    );
  });
});
