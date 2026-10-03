import { ConflictException } from '@nestjs/common';
import { buildAi } from '../ai/ai-gateway.fixture';
import { AiGateway } from '../ai/ai-gateway.service';
import { aiCompletion } from '../ai/ai-completion.fixture';
import { AuditAiService } from './audit-ai.service';
import {
  CREATIVE_MAX_OUTPUT_TOKENS,
  CREATIVE_OBSERVATIONS_JSON_SCHEMA,
  CreativeInputs,
} from './creative/creative-observations';
import { CREATIVE_SYSTEM_PROMPT } from './creative/creative-prompt';

const inputs: CreativeInputs = {
  store: 'APP_STORE',
  country: 'us',
  title: 'Where Am I?',
  iconUrl: 'https://cdn/icon.png',
  screenshotUrls: ['s1.png', 's2.png'],
  competitorIcons: [{ appId: 'app-c1', iconUrl: 'c1.png' }],
};

const serviceOf = (ai: ReturnType<typeof buildAi>) =>
  new AuditAiService(ai as unknown as AiGateway);

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
    await expect(
      service.observe(inputs, 'app_1', 'usr_1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sends the creative prompt, the content and the strict schema', async () => {
    const spend = jest.fn().mockResolvedValue(aiCompletion(response));
    const service = serviceOf(buildAi(spend));

    const observations = await service.observe(inputs, 'app_1', 'usr_1');

    expect(service.model).toBe('gpt-4o');
    const [[, request]] = spend.mock.calls as Array<
      [
        unknown,
        {
          system: string;
          schema: { name: string; schema: unknown };
          maxOutputTokens: number;
          content: unknown[];
        },
      ]
    >;
    expect(request.system).toBe(CREATIVE_SYSTEM_PROMPT);
    expect(request.schema).toEqual({
      name: 'creative_observations',
      schema: CREATIVE_OBSERVATIONS_JSON_SCHEMA,
    });
    expect(request.maxOutputTokens).toBe(CREATIVE_MAX_OUTPUT_TOKENS);
    expect(request.content.length).toBeGreaterThan(0);
    expect(observations.screenshots).toHaveLength(1);
    expect(observations.icon?.similarCompetitorPosition).toBe(1);
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
