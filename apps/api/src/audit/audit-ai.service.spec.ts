import { ConflictException } from '@nestjs/common';
import { buildAi } from '../ai/ai-gateway.fixture';
import { AiGateway } from '../ai/ai-gateway.service';
import { aiCompletion } from '../ai/ai-completion.fixture';
import { ScreenshotFetchError } from '../store-providers/errors';
import { ScreenshotImageSource } from '../store-providers/screenshot-image.source';
import { AuditAiService } from './audit-ai.service';
import { CreativeImages } from './creative/creative-images';
import {
  CREATIVE_OBSERVATIONS_JSON_SCHEMA,
  CreativeInputs,
} from './creative/creative-observations';
import { CREATIVE_SYSTEM_PROMPT } from './creative/creative-prompt';

const image = (name: string) =>
  `https://is1-ssl.mzstatic.com/image/thumb/${name}/392x696bb.jpg`;

const inputs: CreativeInputs = {
  store: 'APP_STORE',
  country: 'us',
  title: 'Where Am I?',
  iconUrl: image('icon'),
  screenshotUrls: [image('s1'), image('s2')],
  competitorIcons: [{ appId: 'app-c1', iconUrl: image('c1') }],
};

const downloaded = (url: string) =>
  Promise.resolve({ bytes: Buffer.from(url), mediaType: 'image/jpeg' });

const serviceOf = (
  ai: ReturnType<typeof buildAi>,
  readListed: jest.Mock = jest.fn(downloaded),
) =>
  new AuditAiService(
    ai as unknown as AiGateway,
    new CreativeImages({ readListed } as unknown as ScreenshotImageSource),
  );

const response = {
  icon: {
    hasText: false,
    elementCount: 'one',
    contrast: 'high',
    similarCompetitorPosition: 1,
  },
  screenshots: [
    {
      position: 1,
      captionText: 'Guess any place',
      captionReadable: true,
      captionLanguage: 'en',
      message: 'benefit',
    },
  ],
  consistentStyle: true,
};

describe('AuditAiService', () => {
  it('refuses without a client', async () => {
    const service = serviceOf(buildAi(undefined, false));

    expect(service.configured).toBe(false);
    expect(service.model).toBeNull();
    expect(service.provider).toBeNull();
    await expect(
      service.observe(inputs, 'app_1', 'usr_1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sends the creative prompt, the content and the strict schema', async () => {
    const spend = jest.fn().mockResolvedValue(aiCompletion(response));
    const service = serviceOf(buildAi(spend));

    const observations = await service.observe(inputs, 'app_1', 'usr_1');

    expect(service.model).toBe('gpt-4o');
    expect(service.provider).toBe('openai');
    const [[, request]] = spend.mock.calls as Array<
      [
        unknown,
        {
          system: string;
          schema: { name: string; schema: unknown };
          content: unknown[];
          background?: boolean;
        },
      ]
    >;
    expect(request.system).toBe(CREATIVE_SYSTEM_PROMPT);
    expect(request.schema).toEqual({
      name: 'creative_observations',
      schema: CREATIVE_OBSERVATIONS_JSON_SCHEMA,
    });
    expect(request.content.length).toBeGreaterThan(0);
    expect(request.background).toBe(true);
    expect(observations.screenshots).toHaveLength(1);
    expect(observations.icon?.similarCompetitorPosition).toBe(1);
  });

  it('sends every listing image inline so the provider never downloads one', async () => {
    const spend = jest.fn().mockResolvedValue(aiCompletion(response));
    const service = serviceOf(buildAi(spend));

    await service.observe(inputs, 'app_1', 'usr_1');

    const [[, request]] = spend.mock.calls as Array<
      [unknown, { content: Array<{ type: string; url?: string }> }]
    >;
    const images = request.content.filter((part) => part.type === 'image');
    expect(images.map((image) => image.url)).toEqual(
      [image('icon'), image('c1'), image('s1'), image('s2')].map(
        (url) =>
          `data:image/jpeg;base64,${Buffer.from(url).toString('base64')}`,
      ),
    );
  });

  it('spends no ai call when a listing image cannot be downloaded', async () => {
    const ai = buildAi(jest.fn().mockResolvedValue(aiCompletion(response)));
    const readListed = jest
      .fn()
      .mockRejectedValue(new ScreenshotFetchError('timed out', true));
    const service = serviceOf(ai, readListed);

    await expect(
      service.observe(inputs, 'app_1', 'usr_1'),
    ).rejects.toMatchObject({ retryable: true });
    await expect(
      service.observeReserved(inputs, 'call_1'),
    ).rejects.toMatchObject({ retryable: true });
    expect(ai.spend).not.toHaveBeenCalled();
    expect(ai.charge).not.toHaveBeenCalled();
  });

  it('drops an observation for a screenshot it never sent', async () => {
    const structured = jest.fn().mockResolvedValue(
      aiCompletion({
        ...response,
        screenshots: [
          ...response.screenshots,
          {
            position: 5,
            captionText: 'never sent',
            captionReadable: true,
            captionLanguage: 'en',
            message: 'feature',
          },
        ],
      }),
    );
    const service = serviceOf(buildAi(structured));

    const observations = await service.observe(inputs, 'app_1', 'usr_1');

    expect(observations.screenshots.map((item) => item.position)).toEqual([1]);
  });

  it('rejects a response that does not match the schema', async () => {
    const structured = jest
      .fn()
      .mockResolvedValue(aiCompletion({ checks: [] }));
    const service = serviceOf(buildAi(structured));

    await expect(
      service.observe(inputs, 'app_1', 'usr_1'),
    ).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('observes through the caller it is given', async () => {
    const ai = buildAi(jest.fn().mockResolvedValue(aiCompletion(response)));
    ai.charge.mockResolvedValue(aiCompletion(response));
    const service = serviceOf(ai);

    const spent = await service.observe(inputs, 'app_1', 'usr_1');
    const charged = await service.observeReserved(inputs, 'call_1');

    expect(ai.spend).toHaveBeenCalledWith(
      { feature: 'creativeAnalysis', appId: 'app_1', userId: 'usr_1' },
      expect.objectContaining({ system: CREATIVE_SYSTEM_PROMPT }),
    );
    expect(ai.charge).toHaveBeenCalledWith(
      'call_1',
      expect.objectContaining({ system: CREATIVE_SYSTEM_PROMPT }),
    );
    expect(charged).toEqual(spent);
    expect(spent.screenshots).toHaveLength(1);
  });
});
