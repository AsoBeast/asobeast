import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { MarketLocalizationRecorder } from './market-localization-recorder';

const ENGLISH = {
  title: 'Where Am I? GeoGuess Map Quiz',
  subtitle: 'World Geography Trivia Game',
  description: 'Discover the world',
  raw: { screenshots: [] },
};

const GERMAN = {
  title: 'Wo bin ich? Geo Quiz',
  subtitle: 'Welt Geografie Spiel',
  description: 'Entdecke die Welt',
  raw: { screenshots: [] },
};

const APP = {
  id: 'app_1',
  workspaceId: 'ws_a',
  store: Store.APP_STORE,
  storeAppId: '6657987209',
  country: 'us',
  isCompetitor: false,
};

const build = (
  options: { home?: typeof ENGLISH | null; createMany?: jest.Mock } = {},
) => {
  const findFirst = jest
    .fn()
    .mockResolvedValue(options.home === undefined ? ENGLISH : options.home);
  const createMany =
    options.createMany ?? jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    appSnapshot: { findFirst },
    appLocalization: { createMany },
  } as unknown as PrismaService;
  return {
    recorder: new MarketLocalizationRecorder(prisma),
    findFirst,
    createMany,
  };
};

const read = (listings: (typeof ENGLISH)[], complete = true) => ({
  changes: [],
  listings,
  complete,
});

describe('MarketLocalizationRecorder', () => {
  it('records the default localization a market listing proves', async () => {
    const { recorder, findFirst, createMany } = build();

    await recorder.record(APP, 'de', GERMAN, read([]));

    expect(findFirst).toHaveBeenCalledWith({
      where: { appId: APP.id, country: null, localization: null },
      orderBy: { capturedAt: 'desc' },
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          appId: APP.id,
          workspaceId: APP.workspaceId,
          localization: 'de',
          origin: 'detected',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('records nothing for the home market, a competitor or a google play app', async () => {
    const { recorder, findFirst, createMany } = build();

    await recorder.record(APP, 'us', GERMAN, read([]));
    await recorder.record(
      { ...APP, isCompetitor: true },
      'de',
      GERMAN,
      read([]),
    );
    await recorder.record(
      { ...APP, store: Store.GOOGLE_PLAY },
      'de',
      GERMAN,
      read([]),
    );

    expect(findFirst).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('records nothing when the store echoes the home listing', async () => {
    const { recorder, createMany } = build();

    await recorder.record(APP, 'de', ENGLISH, read([]));

    expect(createMany).not.toHaveBeenCalled();
  });

  it('records nothing when an additional localization the market read echoes the listing', async () => {
    const { recorder, createMany } = build();

    await recorder.record(APP, 'ch', GERMAN, read([GERMAN]));

    expect(createMany).not.toHaveBeenCalled();
  });

  it('records nothing while a localization the market reads did not answer', async () => {
    const { recorder, findFirst, createMany } = build();

    await recorder.record(APP, 'ch', GERMAN, read([], false));

    expect(findFirst).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('records nothing before the home listing is stored', async () => {
    const { recorder, createMany } = build({ home: null });

    await recorder.record(APP, 'de', GERMAN, read([]));

    expect(createMany).not.toHaveBeenCalled();
  });

  it('never fails the capture', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { recorder } = build({
      createMany: jest.fn().mockRejectedValue(new Error('database is down')),
    });

    try {
      await expect(
        recorder.record(APP, 'de', GERMAN, read([])),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('database is down'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
