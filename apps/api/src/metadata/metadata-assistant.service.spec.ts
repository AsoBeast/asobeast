import { BadRequestException, ConflictException } from '@nestjs/common';
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

  it('refuses a localization for a google play app before reading anything', async () => {
    const structured = jest.fn();
    const findFirst = jest.fn().mockResolvedValue({
      id: 'app-gp',
      store: 'GOOGLE_PLAY',
      country: 'de',
      name: 'Tomato Clock',
    });
    const keywordCountries = jest.fn();
    const audit = jest.fn();
    const service = new MetadataAssistantService(
      { model: 'gpt-4o', structured },
      { app: { findFirst } } as unknown as PrismaService,
      { keywordCountries } as unknown as KeywordsService,
      { audit } as unknown as MetadataService,
    );

    await expect(
      service.generate('app-gp', { localization: 'es-MX' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(keywordCountries).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    expect(structured).not.toHaveBeenCalled();
  });
});
