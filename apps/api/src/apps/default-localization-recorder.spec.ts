import { Logger } from '@nestjs/common';
import { Store } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DefaultLocalizationRecorder } from './default-localization-recorder';
import { descriptionFingerprint } from './description-fingerprint';
import type { LocalizedCapture } from './localized-listing-capture.service';

const POLISH = {
  version: '4.0',
  description:
    'Dzienniczek to aplikacja dla uczniów i rodziców. Sprawdzaj oceny, frekwencję i plan lekcji w jednym miejscu. Aplikacja działa z dziennikiem szkolnym i jest dostępna dla każdej szkoły, która korzysta z systemu. Wszystkie dane są bezpieczne, a logowanie jest proste i szybkie.',
  raw: { languages: ['PL'] },
};

const ENGLISH = {
  version: '4.0',
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

const GERMAN = {
  version: '4.0',
  description:
    'Das Tagebuch ist eine App für Schüler und ihre Eltern. Sieh dir deine Noten, die Anwesenheit und den Stundenplan an einem Ort an. Die App arbeitet mit dem Klassenbuch der Schule und ist für jede Schule offen, die das System nutzt.',
  raw: { languages: ['DE', 'EN'] },
};

const englishProbe = (): LocalizedCapture => ({
  changes: [],
  listings: [],
  probes: [{ localization: 'en-GB', echoed: true }],
  complete: true,
});

const build = (
  update = jest.fn().mockResolvedValue({}),
  synced: unknown = null,
) => {
  const $executeRaw = jest.fn().mockResolvedValue(1);
  const tx = { $executeRaw, app: { update } };
  const findFirst = jest.fn().mockResolvedValue(synced);
  const prisma = {
    keywordFieldSync: { findFirst },
    withTransaction: jest.fn((work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  } as unknown as PrismaService;
  return {
    recorder: new DefaultLocalizationRecorder(prisma),
    update,
    $executeRaw,
    findFirst,
  };
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

  it('writes under the keyword field lock of the app', async () => {
    const { recorder, update, $executeRaw } = build();

    await recorder.record(APP, 'pl', POLISH, captured());

    expect($executeRaw).toHaveBeenCalledTimes(1);
    expect($executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0],
    );
  });

  it('answers the default it leaves on the app', async () => {
    const { recorder } = build();

    await expect(recorder.record(APP, 'pl', POLISH, captured())).resolves.toBe(
      'pl',
    );
    await expect(
      recorder.record(
        { ...APP, defaultLocalization: 'pl' },
        'gb',
        POLISH,
        captured(),
      ),
    ).resolves.toBe('pl');
    await expect(
      recorder.record(APP, 'pl', POLISH, captured(false)),
    ).resolves.toBeNull();
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

  it('records english (u.k.) as the default of an english listing in germany', async () => {
    const { recorder, update } = build();

    await recorder.record(
      { ...APP, country: 'de' },
      'de',
      ENGLISH,
      englishProbe(),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: { defaultLocalization: 'en-GB' },
    });
  });

  it('clears english (u.k.) once the listing reads german', async () => {
    const { recorder, update } = build();

    await recorder.record(
      { ...APP, country: 'de', defaultLocalization: 'en-GB' },
      'de',
      GERMAN,
      englishProbe(),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: { defaultLocalization: null },
    });
  });

  it('records polish for a polish listing in germany without a probe', async () => {
    const { recorder, update } = build();

    await recorder.record({ ...APP, country: 'de' }, 'de', POLISH, {
      changes: [],
      listings: [],
      probes: [],
      complete: true,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: { defaultLocalization: 'pl' },
    });
  });

  it('clears polish in germany once the listing reads german', async () => {
    const { recorder, update } = build();

    await recorder.record(
      { ...APP, country: 'de', defaultLocalization: 'pl' },
      'de',
      GERMAN,
      { changes: [], listings: [], probes: [], complete: true },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: APP.id },
      data: { defaultLocalization: null },
    });
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
      ).resolves.toBeNull();
      expect(warn).toHaveBeenCalledWith(
        'could not record the default localization of app_1: down',
      );
    } finally {
      warn.mockRestore();
    }
  });

  describe('with a console listing', () => {
    const inGermany = { ...APP, country: 'de' };
    const synced = (fingerprints: unknown, version: string | null = '4.0') => ({
      version,
      primaryLocale: 'en-US',
      descriptionFingerprints: fingerprints,
    });

    it('reads the import row by app only and records the localization it names', async () => {
      const { recorder, update, findFirst } = build(
        undefined,
        synced({ 'en-US': descriptionFingerprint(ENGLISH.description) }),
      );

      await recorder.record(inGermany, 'de', ENGLISH, englishProbe());

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { appId: APP.id } }),
      );
      expect(update).toHaveBeenCalledWith({
        where: { id: APP.id },
        data: { defaultLocalization: 'en-US' },
      });
    });

    it('falls back to the public proof without a row', async () => {
      const { recorder, update } = build();

      await recorder.record(inGermany, 'de', ENGLISH, englishProbe());

      expect(update).toHaveBeenCalledWith({
        where: { id: APP.id },
        data: { defaultLocalization: 'en-GB' },
      });
    });

    it('falls back to the public proof on fingerprints it cannot read', async () => {
      const { recorder, update } = build(undefined, synced(['en-US']));

      await recorder.record(inGermany, 'de', ENGLISH, englishProbe());

      expect(update).toHaveBeenCalledWith({
        where: { id: APP.id },
        data: { defaultLocalization: 'en-GB' },
      });
    });

    it('keeps the current localization while the console shows another version', async () => {
      const { recorder, update } = build(
        undefined,
        synced({ 'en-US': descriptionFingerprint('A newer text.') }, '5.0'),
      );

      await expect(
        recorder.record(
          { ...inGermany, defaultLocalization: 'en-US' },
          'de',
          ENGLISH,
          englishProbe(),
        ),
      ).resolves.toBe('en-US');
      expect(update).not.toHaveBeenCalled();
    });

    it('falls through to the public proof on a miss of the same version', async () => {
      const { recorder, update } = build(
        undefined,
        synced({ 'en-US': descriptionFingerprint('Another text.') }),
      );

      await recorder.record(
        { ...inGermany, defaultLocalization: 'en-US' },
        'de',
        ENGLISH,
        englishProbe(),
      );

      expect(update).toHaveBeenCalledWith({
        where: { id: APP.id },
        data: { defaultLocalization: 'en-GB' },
      });
    });
  });
});
