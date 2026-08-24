import { ConflictException } from '@nestjs/common';
import { AiClient } from '../ai/openai.client';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataAssistantService } from './metadata-assistant.service';
import { MetadataService } from './metadata.service';

describe('MetadataAssistantService', () => {
  const deps = [
    {} as unknown as PrismaService,
    {} as unknown as KeywordsService,
    {} as unknown as MetadataService,
  ] as const;

  it('reports unconfigured and rejects generate without a client', async () => {
    const service = new MetadataAssistantService(null, ...deps);
    expect(service.status()).toEqual({ configured: false, model: null });
    await expect(service.generate('app-1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reports configured with the model name', () => {
    const client: AiClient = { model: 'gpt-4o', structured: jest.fn() };
    const service = new MetadataAssistantService(client, ...deps);
    expect(service.status()).toEqual({ configured: true, model: 'gpt-4o' });
  });
});
