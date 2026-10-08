import { BadRequestException, ConflictException } from '@nestjs/common';
import { buildAi } from '../ai/ai-gateway.fixture';
import { AiGateway } from '../ai/ai-gateway.service';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataAssistantService } from './metadata-assistant.service';
import { DRAFT_MAX_OUTPUT_TOKENS } from './metadata-drafts';
import { MetadataService } from './metadata.service';

const gateway = (ai: ReturnType<typeof buildAi>) => ai as unknown as AiGateway;

const appStoreService = (
  spend: jest.Mock,
  audit = jest.fn().mockResolvedValue({ fields: [], coverage: [] }),
) =>
  new MetadataAssistantService(
    gateway(buildAi(spend)),
    {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app-1',
          store: 'APP_STORE',
          country: 'us',
          name: 'Where Am I',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService,
    {
      keywordCountries: jest
        .fn()
        .mockResolvedValue([{ country: 'us', keywordCount: 1 }]),
      listTracked: jest.fn().mockResolvedValue([]),
    } as unknown as KeywordsService,
    { audit } as unknown as MetadataService,
  );

describe('MetadataAssistantService', () => {
  const deps = [
    {} as unknown as PrismaService,
    {} as unknown as KeywordsService,
    {} as unknown as MetadataService,
  ] as const;

  it('reports unconfigured and rejects generate without a client', async () => {
    const service = new MetadataAssistantService(
      gateway(buildAi(undefined, false)),
      ...deps,
    );
    expect(service.status()).toEqual({ configured: false, model: null });
    await expect(service.generate('app-1', {}, 'usr_1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reports configured with the model name', () => {
    const service = new MetadataAssistantService(gateway(buildAi()), ...deps);
    expect(service.status()).toEqual({ configured: true, model: 'gpt-4o' });
  });

  it('refuses a localization for a google play app before reading anything', async () => {
    const spend = jest.fn();
    const findFirst = jest.fn().mockResolvedValue({
      id: 'app-gp',
      store: 'GOOGLE_PLAY',
      country: 'de',
      name: 'Tomato Clock',
    });
    const keywordCountries = jest.fn();
    const audit = jest.fn();
    const service = new MetadataAssistantService(
      gateway(buildAi(spend)),
      { app: { findFirst } } as unknown as PrismaService,
      { keywordCountries } as unknown as KeywordsService,
      { audit } as unknown as MetadataService,
    );

    await expect(
      service.generate('app-gp', { localization: 'es-MX' }, 'usr_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(keywordCountries).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    expect(spend).not.toHaveBeenCalled();
  });

  it('gives a localized draft room to reason before it answers', async () => {
    const spend = jest.fn().mockRejectedValue(new Error('stop'));

    await expect(
      appStoreService(spend).generate(
        'app-1',
        { localization: 'es-MX' },
        'usr_1',
      ),
    ).rejects.toThrow('stop');
    expect(spend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS }),
    );
    expect(DRAFT_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(4096);
  });

  it('drafts through the gateway on behalf of the requesting user', async () => {
    const spend = jest.fn().mockRejectedValue(new Error('stop'));

    await expect(
      appStoreService(spend).generate('app-1', {}, 'usr_1'),
    ).rejects.toThrow('stop');
    expect(spend).toHaveBeenCalledTimes(1);
    expect(spend).toHaveBeenCalledWith(
      { feature: 'metadataDrafts', appId: 'app-1', userId: 'usr_1' },
      expect.objectContaining({ maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS }),
    );
  });

  it('drafts from the coverage of the home listing only', async () => {
    const spend = jest.fn().mockRejectedValue(new Error('stop'));
    const audit = jest.fn().mockResolvedValue({ fields: [], coverage: [] });

    await expect(
      appStoreService(spend, audit).generate('app-1', {}, 'usr_1'),
    ).rejects.toThrow('stop');
    expect(audit).toHaveBeenCalledWith('app-1', 'us');
  });
});
