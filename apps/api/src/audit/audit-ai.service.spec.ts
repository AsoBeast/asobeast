import { ConflictException } from '@nestjs/common';
import { AiClient } from '../ai/openai.client';
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
    const service = new AuditAiService(null);

    expect(service.configured).toBe(false);
    expect(service.model).toBeNull();
    await expect(service.observe(inputs)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sends the creative prompt, the content and the strict schema', async () => {
    const structured = jest.fn().mockResolvedValue(response);
    const client: AiClient = { model: 'gpt-5.6-luna', structured };
    const service = new AuditAiService(client);

    const observations = await service.observe(inputs);

    expect(service.model).toBe('gpt-5.6-luna');
    const [[request]] = structured.mock.calls as Array<
      [
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
    const structured = jest.fn().mockResolvedValue({
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
    });
    const service = new AuditAiService({ model: 'gpt-4o', structured });

    const observations = await service.observe(inputs);

    expect(observations.screenshots.map((item) => item.position)).toEqual([1]);
  });

  it('rejects a response that does not match the schema', async () => {
    const structured = jest.fn().mockResolvedValue({ checks: [] });
    const service = new AuditAiService({ model: 'gpt-4o', structured });

    await expect(service.observe(inputs)).rejects.toMatchObject({
      retryable: true,
    });
  });
});
