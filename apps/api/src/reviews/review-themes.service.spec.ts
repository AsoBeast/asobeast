import type { ConfigService } from '@nestjs/config';
import { Store } from '@prisma/client';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { ReviewThemesService } from './review-themes.service';

const APP = {
  id: 'app_1',
  name: 'Habit Tracker',
  store: Store.APP_STORE,
  country: 'us',
};

const crash = (id: number, score: number) => ({
  id: `r${id}`,
  title: null,
  text: 'the app crashes on launch every single time',
  score,
});
const praise = (id: number) => ({
  id: `p${id}`,
  title: null,
  text: 'lovely calm design and great reminders',
  score: 5,
});

const build = () => {
  const baseline = [
    ...Array.from({ length: 30 }, (_, index) => praise(index)),
    ...Array.from({ length: 6 }, (_, index) => crash(index, 1)),
  ];
  const day = Array.from({ length: 6 }, (_, index) => crash(index, 1));
  const findMany = jest
    .fn()
    .mockResolvedValueOnce(baseline)
    .mockResolvedValueOnce(day);
  const service = new ReviewThemesService(
    {
      app: { findFirst: jest.fn().mockResolvedValue(APP) },
      review: { findMany, fields: { repliedAt: {} } },
    } as unknown as PrismaService,
    { get: () => 2 } as unknown as ConfigService<Env, true>,
  );
  return { service, findMany };
};

describe('ReviewThemesService.dayTheme', () => {
  it('reads the newest reviews as the baseline and the day as the shown set', async () => {
    const { service, findMany } = build();

    await service.dayTheme(APP, '2026-11-02');

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { appId: 'app_1' }, take: 500 }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          appId: 'app_1',
          reviewedAt: {
            gte: new Date('2026-11-02T00:00:00.000Z'),
            lt: new Date('2026-11-03T00:00:00.000Z'),
          },
        },
        take: 200,
      }),
    );
  });

  it('answers the theme the reviews page would show first', async () => {
    const day = build();
    const page = build();

    const theme = await day.service.dayTheme(APP, '2026-11-02');
    const themes = await page.service.themes('app_1', {});

    expect(theme).not.toBeNull();
    expect(theme).toEqual({
      phrase: themes.themes[0].phrase,
      kind: themes.themes[0].kind,
      mentions: themes.themes[0].mentions,
    });
  });

  it('answers null when nothing stands out', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReviewThemesService(
      { review: { findMany } } as unknown as PrismaService,
      { get: () => 2 } as unknown as ConfigService<Env, true>,
    );

    await expect(service.dayTheme(APP, '2026-11-02')).resolves.toBeNull();
  });
});
