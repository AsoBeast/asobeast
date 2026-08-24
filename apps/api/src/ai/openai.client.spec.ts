import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiClient, createOpenAiClient } from './openai.client';
import { Env } from '../config/env';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const config = (
  key: string | undefined,
  model = 'gpt-4o',
): ConfigService<Env, true> =>
  ({
    get: (name: string) => (name === 'OPENAI_API_KEY' ? key : model),
  }) as unknown as ConfigService<Env, true>;

const completion = (
  choice: Record<string, unknown>,
): Record<string, unknown> => ({ choices: [choice] });

const stop = (content: string | null, refusal: string | null = null) =>
  completion({ finish_reason: 'stop', message: { content, refusal } });

const request = {
  system: 'system',
  content: [
    { type: 'text' as const, text: 'hello' },
    { type: 'image' as const, url: 'https://cdn/icon.png' },
  ],
  schema: { name: 'test', schema: { type: 'object' } },
};

const build = (): AiClient => {
  const client = createOpenAiClient(config('sk-test'));
  if (!client) {
    throw new Error('expected a configured client');
  }
  return client;
};

describe('createOpenAiClient', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  it('returns null without an api key', () => {
    expect(createOpenAiClient(config(undefined))).toBeNull();
  });

  it('constructs the SDK with a bounded timeout and retries', () => {
    build();
    const calls = (OpenAI as unknown as jest.Mock).mock.calls as Array<
      [{ apiKey: string; timeout: number; maxRetries: number }]
    >;
    const options = calls[0][0];
    expect(options.apiKey).toBe('sk-test');
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.maxRetries).toBeGreaterThanOrEqual(0);
  });

  it('parses JSON and maps text and image content parts', async () => {
    mockCreate.mockResolvedValue(stop('{"ok":true}'));
    const result = await build().structured(request);
    expect(result).toEqual({ ok: true });

    const createCalls = mockCreate.mock.calls as Array<
      [{ messages: Array<{ role: string; content: unknown }> }]
    >;
    const payload = createCalls[0][0];
    expect(payload.messages[1].content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: 'https://cdn/icon.png' } },
    ]);
  });

  it('rejects a refusal', async () => {
    mockCreate.mockResolvedValue(stop(null, 'not allowed'));
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects a truncated (length) completion', async () => {
    mockCreate.mockResolvedValue(
      completion({ finish_reason: 'length', message: { content: '{"ok":1}' } }),
    );
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects a content-filtered completion even if content parses', async () => {
    mockCreate.mockResolvedValue(
      completion({
        finish_reason: 'content_filter',
        message: { content: '{"ok":1}' },
      }),
    );
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects empty content', async () => {
    mockCreate.mockResolvedValue(stop(''));
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects invalid JSON', async () => {
    mockCreate.mockResolvedValue(stop('not json'));
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps a request failure to a bad gateway', async () => {
    mockCreate.mockRejectedValue(new Error('network down'));
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects a response with no choices', async () => {
    mockCreate.mockResolvedValue({ choices: [] });
    await expect(build().structured(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
