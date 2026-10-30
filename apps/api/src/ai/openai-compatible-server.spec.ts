import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';
import {
  AiClient,
  AiRequestError,
  AiStructuredRequest,
  createOpenAiClient,
} from './openai.client';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

interface SeenRequest {
  method: string | undefined;
  url: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown>;
}

interface FakeProvider {
  origin: string;
  seen: SeenRequest[];
  answer: Handler;
  close(): Promise<void>;
}

const KEY = 'local-provider-key';
const MODEL = 'local-model';
const ACCOUNT_VARIABLES = [
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'OPENAI_PROJECT_ID',
] as const;

const COMPLETION = {
  id: 'chatcmpl-local',
  object: 'chat.completion',
  created: 0,
  model: MODEL,
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: {
        role: 'assistant',
        content: '{"explanation":"Fine."}',
        refusal: null,
      },
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
};

const REQUEST: AiStructuredRequest = {
  system: 'system',
  content: [
    { type: 'text', text: 'hello' },
    {
      type: 'image',
      url: 'https://is1-ssl.mzstatic.com/icon.png',
      detail: 'low',
    },
  ],
  schema: { name: 'action_explanation', schema: { type: 'object' } },
};

const json =
  (status: number, body: unknown): Handler =>
  (_, response) =>
    response
      .writeHead(status, { 'content-type': 'application/json' })
      .end(JSON.stringify(body));

const startProvider = async (): Promise<FakeProvider> => {
  const seen: SeenRequest[] = [];
  const provider: Omit<FakeProvider, 'origin' | 'close'> = {
    seen,
    answer: json(200, COMPLETION),
  };
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => {
      seen.push({
        method: request.method,
        url: request.url ?? '',
        headers: request.headers,
        body: JSON.parse(body || '{}') as Record<string, unknown>,
      });
      provider.answer(request, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return Object.assign(provider, {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  });
};

const clientAt = (baseUrl: string): AiClient => {
  const values: Partial<Record<keyof Env, unknown>> = {
    OPENAI_API_KEY: KEY,
    AI_MODEL: MODEL,
    OPENAI_BASE_URL: baseUrl,
  };
  const client = createOpenAiClient({
    get: (name: keyof Env) => values[name],
  } as unknown as ConfigService<Env, true>);
  if (!client) {
    throw new Error('expected a configured client');
  }
  return client;
};

describe('an OpenAI compatible provider over http', () => {
  let provider: FakeProvider;
  let other: FakeProvider;
  const saved = new Map<string, string | undefined>();

  beforeAll(async () => {
    provider = await startProvider();
    other = await startProvider();
  });

  afterAll(async () => {
    await provider.close();
    await other.close();
  });

  beforeEach(() => {
    provider.seen.length = 0;
    other.seen.length = 0;
    provider.answer = json(200, COMPLETION);
    for (const name of ACCOUNT_VARIABLES) saved.set(name, process.env[name]);
  });

  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('posts the chat completion to the configured address with the bearer key', async () => {
    await expect(
      clientAt(`${provider.origin}/v1`).structured(REQUEST),
    ).resolves.toEqual({
      output: { explanation: 'Fine.' },
      usage: { inputTokens: 12, cachedInputTokens: 0, outputTokens: 4 },
    });

    expect(provider.seen).toHaveLength(1);
    const [sent] = provider.seen;
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe('/v1/chat/completions');
    expect(sent.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent.body).toMatchObject({
      model: MODEL,
      max_completion_tokens: 2048,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'action_explanation', strict: true },
      },
    });
  });

  it('joins the path the same way when the address ends with a slash', async () => {
    await clientAt(`${provider.origin}/v1/`).structured(REQUEST);

    expect(provider.seen[0].url).toBe('/v1/chat/completions');
  });

  it('keeps a query string the address carries', async () => {
    await clientAt(
      `${provider.origin}/openai/v1?api-version=preview`,
    ).structured(REQUEST);

    const sent = new URL(provider.seen[0].url, provider.origin);
    expect(sent.pathname).toBe('/openai/v1/chat/completions');
    expect(sent.searchParams.get('api-version')).toBe('preview');
  });

  it('sends no OpenAI account headers to another provider', async () => {
    process.env.OPENAI_ORG_ID = 'org-of-the-operator';
    process.env.OPENAI_PROJECT_ID = 'proj-of-the-operator';

    await clientAt(`${provider.origin}/v1`).structured(REQUEST);

    expect(provider.seen[0].headers).not.toHaveProperty('openai-organization');
    expect(provider.seen[0].headers).not.toHaveProperty('openai-project');
  });

  it('never follows an OPENAI_BASE_URL the config did not validate', async () => {
    process.env.OPENAI_BASE_URL = `${other.origin}/v1`;

    await clientAt(`${provider.origin}/v1`).structured(REQUEST);

    expect(provider.seen).toHaveLength(1);
    expect(other.seen).toHaveLength(0);
  });

  it('reads an answer that reports no usage', async () => {
    provider.answer = json(200, { ...COMPLETION, usage: undefined });

    await expect(
      clientAt(`${provider.origin}/v1`).structured(REQUEST),
    ).resolves.toEqual({ output: { explanation: 'Fine.' }, usage: null });
  });

  it('says why a provider routes no endpoint to the model', async () => {
    provider.answer = json(404, {
      error: {
        message: 'No endpoints found that support image URLs',
        code: 404,
        metadata: { failed_routing_step: 'Filter by Image Support' },
      },
    });

    await expect(
      clientAt(`${provider.origin}/v1`).structured(REQUEST),
    ).rejects.toMatchObject({
      message:
        'The AI provider does not offer the model local-model for this request: No endpoints found that support image URLs',
      retryable: false,
    });
    expect(provider.seen).toHaveLength(1);
  });

  it('never answers with the key a provider echoes back', async () => {
    provider.answer = json(400, {
      error: {
        message: `model not allowed for key ${KEY}`,
        type: 'invalid_request_error',
      },
    });

    const failure = (await clientAt(`${provider.origin}/v1`)
      .structured(REQUEST)
      .catch((caught: unknown) => caught)) as AiRequestError;

    expect(failure.message).not.toContain(KEY);
    expect(failure.message).toMatch(/^The AI provider refused the request: /);
  });

  it('reports a refused key once, as a request error that is not retried', async () => {
    provider.answer = json(401, {
      error: {
        message: 'Invalid API key',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      },
    });

    const failure = await clientAt(`${provider.origin}/v1`)
      .structured(REQUEST)
      .catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(AiRequestError);
    expect(failure).toMatchObject({
      message: 'The AI provider rejected the API key. Check OPENAI_API_KEY.',
      retryable: false,
    });
    expect(provider.seen).toHaveLength(1);
  });
});
