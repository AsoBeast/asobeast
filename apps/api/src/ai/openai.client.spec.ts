import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  type ClientOptions,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from 'openai';
import {
  AiClient,
  AiRequestError,
  UnusableAnswerError,
  classifyRequestError,
  createOpenAiClient,
} from './openai.client';
import { Env } from '../config/env';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  const actual = jest.requireActual<typeof import('openai')>('openai');
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

const config = (
  key: string | undefined,
  model = 'gpt-4o',
  baseUrl?: string,
): ConfigService<Env, true> => {
  const values: Partial<Record<keyof Env, unknown>> = {
    OPENAI_API_KEY: key,
    AI_MODEL: model,
    OPENAI_BASE_URL: baseUrl,
  };
  return {
    get: (name: keyof Env) => values[name],
  } as unknown as ConfigService<Env, true>;
};

const completion = (
  choice: Record<string, unknown>,
): Record<string, unknown> => ({ choices: [choice] });

const stop = (content: string | null, refusal: string | null = null) =>
  completion({ finish_reason: 'stop', message: { content, refusal } });

const USAGE = {
  prompt_tokens: 1_200,
  completion_tokens: 300,
  total_tokens: 1_500,
  prompt_tokens_details: { cached_tokens: 1_024 },
};

const withUsage = (body: Record<string, unknown>) => ({
  ...body,
  usage: USAGE,
});

const request = {
  system: 'system',
  content: [
    { type: 'text' as const, text: 'hello' },
    {
      type: 'image' as const,
      url: 'https://cdn/icon.png',
      detail: 'low' as const,
    },
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

const sdkOptions = (): ClientOptions => {
  const calls = (OpenAI as unknown as jest.Mock).mock.calls as Array<
    [ClientOptions]
  >;
  return calls[calls.length - 1][0];
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

  it('leaves the SDK on its default address when OPENAI_BASE_URL is unset', () => {
    build();

    expect(sdkOptions().baseURL).toBeNull();
    expect(sdkOptions()).not.toHaveProperty('organization');
    expect(sdkOptions()).not.toHaveProperty('project');
  });

  it('hands the SDK the address OPENAI_BASE_URL names', () => {
    createOpenAiClient(
      config(
        'sk-or-v1-test',
        'openai/gpt-5.6-luna',
        'https://openrouter.ai/api/v1',
      ),
    );

    expect(sdkOptions()).toMatchObject({
      apiKey: 'sk-or-v1-test',
      baseURL: 'https://openrouter.ai/api/v1',
      organization: null,
      project: null,
    });
  });

  it('keeps the OpenAI account headers on an OpenAI residency host', () => {
    createOpenAiClient(
      config('sk-test', 'gpt-4o', 'https://eu.api.openai.com/v1'),
    );

    expect(sdkOptions().baseURL).toBe('https://eu.api.openai.com/v1');
    expect(sdkOptions()).not.toHaveProperty('organization');
  });

  it('returns null without an api key even when an address is set', () => {
    expect(
      createOpenAiClient(
        config(undefined, 'gpt-4o', 'http://localhost:11434/v1'),
      ),
    ).toBeNull();
  });

  it('parses JSON and maps text and image content parts', async () => {
    mockCreate.mockResolvedValue(stop('{"ok":true}'));
    const { output } = await build().structured(request);
    expect(output).toEqual({ ok: true });

    const createCalls = mockCreate.mock.calls as Array<
      [{ messages: Array<{ role: string; content: unknown }> }]
    >;
    const payload = createCalls[0][0];
    expect(payload.messages[1].content).toEqual([
      { type: 'text', text: 'hello' },
      {
        type: 'image_url',
        image_url: { url: 'https://cdn/icon.png', detail: 'low' },
      },
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

const headers = new Headers();

const REQUEST_FAILURES: Array<[unknown, string, boolean]> = [
  [
    new AuthenticationError(401, {}, 'bad key', headers),
    'OpenAI rejected the API key. Check OPENAI_API_KEY.',
    false,
  ],
  [
    new PermissionDeniedError(403, {}, 'denied', headers),
    'The OpenAI key cannot use gpt-4o.',
    false,
  ],
  [
    new NotFoundError(404, {}, 'missing', headers),
    'OpenAI does not offer the model gpt-4o. Check AI_MODEL.',
    false,
  ],
  [
    new BadRequestError(
      400,
      { message: 'image input not supported' },
      undefined,
      headers,
    ),
    'OpenAI refused the request: image input not supported',
    false,
  ],
  [
    new RateLimitError(429, { code: 'insufficient_quota' }, 'quota', headers),
    'The OpenAI account has no remaining quota.',
    false,
  ],
  [
    new RateLimitError(
      429,
      { code: 'rate_limit_exceeded' },
      'slow down',
      headers,
    ),
    'OpenAI is rate limiting requests.',
    true,
  ],
  [
    new InternalServerError(500, {}, 'boom', headers),
    'OpenAI had an internal error.',
    true,
  ],
  [new APIConnectionTimeoutError(), 'OpenAI did not answer in time.', true],
  [
    new APIConnectionError({ message: 'socket hang up' }),
    'Could not reach OpenAI.',
    true,
  ],
  [
    new APIError(408, {}, 'request timeout', headers),
    'OpenAI request failed.',
    true,
  ],
  [
    new ConflictError(409, {}, 'conflict', headers),
    'OpenAI request failed.',
    true,
  ],
  [
    new APIError(413, {}, 'payload too large', headers),
    'OpenAI request failed.',
    false,
  ],
  [
    new UnprocessableEntityError(422, {}, 'unprocessable', headers),
    'OpenAI request failed.',
    false,
  ],
  [new Error('unexpected'), 'OpenAI request failed.', false],
];

describe('AiRequestError', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it.each(REQUEST_FAILURES)(
    'maps a request failure to %s',
    async (error, message, retryable) => {
      mockCreate.mockRejectedValue(error);

      const failure = await build()
        .structured(request)
        .catch((caught: unknown) => caught);

      expect(failure).toBeInstanceOf(AiRequestError);
      expect(failure).toBeInstanceOf(BadGatewayException);
      expect(failure).toMatchObject({ message, retryable });
    },
  );

  it.each([
    [
      completion({
        finish_reason: 'length',
        message: { content: '{"a":', refusal: null },
      }),
      'The model ran out of output tokens.',
      false,
    ],
    [
      completion({
        finish_reason: 'content_filter',
        message: { content: null, refusal: null },
      }),
      'OpenAI filtered the response.',
      false,
    ],
    [
      stop(null, 'I cannot help with that'),
      'OpenAI refused to analyze this listing.',
      false,
    ],
    [stop('not json'), 'OpenAI returned an unreadable response.', true],
  ])(
    'maps a completion that cannot be used',
    async (response, message, retryable) => {
      mockCreate.mockResolvedValue(response);

      await expect(build().structured(request)).rejects.toMatchObject({
        message,
        retryable,
      });
    },
  );

  it('sends the image detail it is given', async () => {
    mockCreate.mockResolvedValue(stop('{"ok":true}'));

    await build().structured({
      ...request,
      content: [
        { type: 'image', url: 'https://cdn/s1.png', detail: 'high' as const },
      ],
    });

    const [[payload]] = mockCreate.mock.calls as Array<
      [{ messages: Array<{ content: unknown }> }]
    >;
    expect(payload.messages[1].content).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://cdn/s1.png', detail: 'high' },
      },
    ]);
  });

  it('never puts the key in a message', async () => {
    mockCreate.mockRejectedValue(
      new AuthenticationError(
        401,
        {},
        'Incorrect API key provided: sk-test',
        headers,
      ),
    );

    const failure = (await build()
      .structured(request)
      .catch((caught: unknown) => caught)) as Error;

    expect(failure.message).not.toContain('sk-test');
  });
});

const buildCompatible = (): AiClient => {
  const client = createOpenAiClient(
    config('sk-or-v1-test', 'gpt-4o', 'https://openrouter.ai/api/v1'),
  );
  if (!client) {
    throw new Error('expected a configured client');
  }
  return client;
};

describe('AiRequestError from a compatible provider', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it.each(REQUEST_FAILURES)(
    'never names OpenAI for %s',
    async (error, _message, retryable) => {
      mockCreate.mockRejectedValue(error);

      const failure = (await buildCompatible()
        .structured(request)
        .catch((caught: unknown) => caught)) as AiRequestError;

      expect(failure).toBeInstanceOf(AiRequestError);
      expect(failure.message).not.toMatch(/OpenAI/);
      expect(failure.retryable).toBe(retryable);
    },
  );

  it.each([
    [
      new AuthenticationError(401, {}, 'bad key', headers),
      'The AI provider rejected the API key. Check OPENAI_API_KEY.',
    ],
    [
      new PermissionDeniedError(403, {}, 'no access', headers),
      'The API key cannot use gpt-4o.',
    ],
    [
      new NotFoundError(404, {}, 'missing', headers),
      'The AI provider does not offer the model gpt-4o. Check AI_MODEL.',
    ],
    [
      new RateLimitError(429, { code: 'insufficient_quota' }, 'quota', headers),
      'The AI provider account has no remaining quota.',
    ],
    [
      new APIConnectionError({ message: 'down' }),
      'Could not reach the AI provider.',
    ],
  ])('words %p for the provider', async (error, message) => {
    mockCreate.mockRejectedValue(error);

    await expect(buildCompatible().structured(request)).rejects.toMatchObject({
      message,
    });
  });

  it.each([
    [stop(null, 'no'), 'The AI provider refused to analyze this listing.'],
    [stop('not json'), 'The AI provider returned an unreadable response.'],
    [stop(null), 'The AI provider returned an empty response.'],
    [{ choices: [] }, 'The AI provider returned no choices.'],
    [
      completion({
        finish_reason: 'content_filter',
        message: { content: null, refusal: null },
      }),
      'The AI provider filtered the response.',
    ],
  ])('words an unusable answer for the provider', async (response, message) => {
    mockCreate.mockResolvedValue(response);

    await expect(buildCompatible().structured(request)).rejects.toMatchObject({
      message,
    });
  });
});

describe('token usage', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns the parsed output with the token usage the completion reported', async () => {
    mockCreate.mockResolvedValue(withUsage(stop('{"ok":true}')));
    await expect(build().structured(request)).resolves.toEqual({
      output: { ok: true },
      usage: {
        inputTokens: 1_200,
        cachedInputTokens: 1_024,
        outputTokens: 300,
      },
    });
  });

  it('reports no usage when the completion carries none', async () => {
    mockCreate.mockResolvedValue(stop('{"ok":true}'));
    await expect(build().structured(request)).resolves.toEqual({
      output: { ok: true },
      usage: null,
    });
  });

  it.each([
    ['a refusal', stop(null, 'no')],
    [
      'a length cut',
      completion({
        finish_reason: 'length',
        message: { content: '{', refusal: null },
      }),
    ],
    [
      'a content filter',
      completion({
        finish_reason: 'content_filter',
        message: { content: '{}', refusal: null },
      }),
    ],
    ['no choices', { choices: [] }],
    ['empty content', stop('')],
    ['unreadable json', stop('{not json')],
  ])('throws an unusable answer carrying the usage for %s', async (_, body) => {
    mockCreate.mockResolvedValue(withUsage(body));
    const error = await build()
      .structured(request)
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(UnusableAnswerError);
    expect((error as UnusableAnswerError).usage).toEqual({
      inputTokens: 1_200,
      cachedInputTokens: 1_024,
      outputTokens: 300,
    });
  });

  it.each(REQUEST_FAILURES)(
    'never classifies a failed request as an unusable answer: %s',
    (error) => {
      expect(classifyRequestError(error, 'gpt-4o')).not.toBeInstanceOf(
        UnusableAnswerError,
      );
    },
  );

  it('words a failure for OpenAI when no provider is given', () => {
    expect(
      classifyRequestError(
        new APIConnectionError({ message: 'down' }),
        'gpt-4o',
      ).message,
    ).toBe('Could not reach OpenAI.');
  });
});
