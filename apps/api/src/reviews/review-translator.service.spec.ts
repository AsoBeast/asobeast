import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { aiCompletion } from '../ai/ai-completion.fixture';
import { buildAi } from '../ai/ai-gateway.fixture';
import type { AiGateway } from '../ai/ai-gateway.service';
import type { AiStructuredRequest } from '../ai/openai.client';
import type { PrismaService } from '../prisma/prisma.service';
import { TRANSLATION_CLEARED } from './review-translation';
import { ReviewTranslator } from './review-translator.service';

const TRANSLATED_AT = new Date('2026-10-15T12:00:00.000Z');

const REVIEW = {
  id: 'rev-1',
  title: 'Stürzt ab',
  text: 'Die App stürzt beim Start ab.',
  ...TRANSLATION_CLEARED,
};

const setup = (
  options: {
    review?: Record<string, unknown> | null;
    output?: unknown;
    configured?: boolean;
  } = {},
) => {
  const spend = jest
    .fn<Promise<unknown>, [Record<string, unknown>, AiStructuredRequest]>()
    .mockResolvedValue(
      aiCompletion(
        options.output ?? {
          title: 'Crashes',
          text: 'The app crashes on start.',
          sourceLanguage: 'de',
        },
      ),
    );
  const ai = buildAi(
    options.configured === false ? undefined : spend,
    options.configured ?? true,
  );
  const update = jest
    .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
    .mockImplementation(({ data }) => Promise.resolve({ ...REVIEW, ...data }));
  const prisma = {
    review: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.review === null ? null : { ...REVIEW, ...options.review },
        ),
      update,
    },
  };
  const translator = new ReviewTranslator(
    ai as unknown as AiGateway,
    prisma as unknown as PrismaService,
  );
  return { translator, spend, update, prisma };
};

describe('ReviewTranslator.translate', () => {
  it('spends one call under the review translation feature and keeps the answer', async () => {
    const { translator, spend, update } = setup();

    const result = await translator.translate('app-1', 'rev-1', 'en', 'user-1');

    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend.mock.calls[0][0]).toEqual({
      feature: 'reviewTranslation',
      appId: 'app-1',
      userId: 'user-1',
    });
    expect(spend.mock.calls[0][1].schema.name).toBe('review_translation');
    expect(update.mock.calls[0][0].data).toMatchObject({
      translationLanguage: 'en',
      sourceLanguage: 'de',
      translatedTitle: 'Crashes',
      translatedText: 'The app crashes on start.',
    });
    expect(result).toMatchObject({
      language: 'en',
      sourceLanguage: 'de',
      title: 'Crashes',
      text: 'The app crashes on start.',
    });
  });

  it('answers the kept translation for the same language without spending', async () => {
    const { translator, spend, update } = setup({
      review: {
        translationLanguage: 'en',
        sourceLanguage: 'de',
        translatedTitle: 'Crashes',
        translatedText: 'The app crashes on start.',
        translatedAt: TRANSLATED_AT,
      },
      configured: false,
    });

    await expect(
      translator.translate('app-1', 'rev-1', 'en', 'user-1'),
    ).resolves.toEqual({
      language: 'en',
      sourceLanguage: 'de',
      title: 'Crashes',
      text: 'The app crashes on start.',
      translatedAt: TRANSLATED_AT.toISOString(),
    });
    expect(spend).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('translates again into a language other than the kept one', async () => {
    const { translator, spend } = setup({
      review: {
        translationLanguage: 'fr',
        sourceLanguage: 'de',
        translatedText: 'Elle plante.',
        translatedAt: TRANSLATED_AT,
      },
    });

    await translator.translate('app-1', 'rev-1', 'en', 'user-1');

    expect(spend).toHaveBeenCalledTimes(1);
  });

  it('refuses before spending: an unknown review, no text and an unknown language', async () => {
    const missing = setup({ review: null });
    const empty = setup({ review: { title: null, text: '  ' } });
    const unknown = setup();

    await expect(
      missing.translator.translate('app-1', 'rev-x', 'en', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      empty.translator.translate('app-1', 'rev-1', 'en', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      unknown.translator.translate('app-1', 'rev-1', 'qq', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    for (const { spend } of [missing, empty, unknown]) {
      expect(spend).not.toHaveBeenCalled();
    }
  });

  it('answers 409 without a key when nothing is kept', async () => {
    const { translator } = setup({ configured: false });

    await expect(
      translator.translate('app-1', 'rev-1', 'en', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers 502 and stores nothing for an unusable answer', async () => {
    const { translator, update } = setup({
      output: { title: '', text: '', sourceLanguage: 'de' },
    });

    await expect(
      translator.translate('app-1', 'rev-1', 'en', 'user-1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(update).not.toHaveBeenCalled();
  });
});
