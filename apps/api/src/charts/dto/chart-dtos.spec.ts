import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChartGenresQueryDto } from './chart-genres-query.dto';
import { ChartPageQueryDto } from './chart-page-query.dto';

const KEY = {
  store: 'APP_STORE',
  country: 'us',
  collection: 'free',
  genre: '6014',
  device: 'iphone',
};

async function refusedFields<T extends object>(
  dto: new () => T,
  values: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, values));
  return errors.map((error) => error.property);
}

describe('chart dtos', () => {
  it('accepts a chart key with its defaults', async () => {
    const page = plainToInstance(ChartPageQueryDto, KEY);

    await expect(validate(page)).resolves.toEqual([]);
    expect(page.compare).toBe('1d');
    expect(page.dates).toBe(90);
  });

  it.each([
    ['store', { store: 'OTHER' }],
    ['country', { country: 'usa' }],
    ['collection', { collection: 'top' }],
    ['genre', { genre: 'x'.repeat(33) }],
    ['device', { device: 'ipad' }],
    ['compare', { compare: '2d' }],
    ['date', { date: '2026-02-30' }],
    ['date', { date: '2026-10-01T00:00:00Z' }],
    ['dates', { dates: '0' }],
    ['dates', { dates: '366' }],
  ])('refuses a bad %s', async (field, override) => {
    await expect(
      refusedFields(ChartPageQueryDto, { ...KEY, ...override }),
    ).resolves.toEqual([field]);
  });

  it('accepts a day on the calendar', async () => {
    await expect(
      refusedFields(ChartPageQueryDto, { ...KEY, date: '2024-02-29' }),
    ).resolves.toEqual([]);
  });

  it('needs a store to list genres', async () => {
    await expect(refusedFields(ChartGenresQueryDto, {})).resolves.toEqual([
      'store',
    ]);
    await expect(
      refusedFields(ChartGenresQueryDto, { store: 'GOOGLE_PLAY' }),
    ).resolves.toEqual([]);
  });
});
