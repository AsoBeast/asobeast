import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DefaultLocalizationRecorder } from './default-localization-recorder';
import type { LocalizedCapture } from './localized-listing-capture.service';

const POLISH = {
  description:
    'Dzienniczek to aplikacja dla uczniów i rodziców. Sprawdzaj oceny, frekwencję i plan lekcji w jednym miejscu. Aplikacja działa z dziennikiem szkolnym i jest dostępna dla każdej szkoły, która korzysta z systemu. Wszystkie dane są bezpieczne, a logowanie jest proste i szybkie.',
  raw: { languages: ['PL'] },
};

const ENGLISH = {
  description:
    'The diary is an app for students and their parents. Check your grades, attendance and timetable in one place. The app works with the school register and is open to every school that uses the system.',
  raw: { languages: ['EN', 'PL'] },
};

const APP = {
  id: 'app_1',
  workspaceId: 'ws_a',
  store: Store.APP_STORE,
  storeAppId: '1471640866',
  country: 'pl',
  isCompetitor: false,
  defaultLocalization: null,
};

const captured = (complete = true): LocalizedCapture => ({
  changes: [],
  listings: [],
  probes: [{ localization: 'pl', echoed: true }],
  complete,
});

const build = (update = jest.fn().mockResolvedValue({})) => {
  const prisma = { app: { update } } as unknown as PrismaService;
  return { recorder: new DefaultLocalizationRecorder(prisma), update };
};

describe('DefaultLocalizationRecorder', () => {
  it('records the proven default of a home listing', async () => {
    const { recorder, update } = build();

    await recorder.record(APP, 'pl', POLISH, captured());

    expect(update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: { defaultLocalization: 'pl' },
    });
  });

  it('clears a default the capture no longer proves', async () => {
    const { recorder, update } = build();

    await recorder.record(
      { ...APP, defaultLocalization: 'pl' },
      'pl',
      ENGLISH,
      captured(),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: { defaultLocalization: null },
    });
  });

  it('writes nothing when the default is unchanged', async () => {
    const { recorder, update } = build();

    await recorder.record(
      { ...APP, defaultLocalization: 'pl' },
      'pl',
      POLISH,
      captured(),
    );
    await recorder.record(APP, 'pl', ENGLISH, captured());

    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['a market capture', APP, 'gb', captured()],
    ['a competitor', { ...APP, isCompetitor: true }, 'pl', captured()],
    [
      'a google play app',
      { ...APP, store: Store.GOOGLE_PLAY },
      'pl',
      captured(),
    ],
    ['an incomplete capture', APP, 'pl', captured(false)],
  ])('records nothing for %s', async (_case, app, market, localized) => {
    const { recorder, update } = build();

    await recorder.record(app, market, POLISH, localized);

    expect(update).not.toHaveBeenCalled();
  });

  it('never fails the capture', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { recorder } = build(jest.fn().mockRejectedValue(new Error('down')));

    try {
      await expect(
        recorder.record(APP, 'pl', POLISH, captured()),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        'could not record the default localization of app_1: down',
      );
    } finally {
      warn.mockRestore();
    }
  });
});
