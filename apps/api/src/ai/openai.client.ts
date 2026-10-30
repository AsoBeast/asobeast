import type { AiProvider } from '@asobeast/shared';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';
import { scrubText } from '../common/logging/log-redaction';
import { Env } from '../config/env';
import { AI_PROVIDER_WORDING, aiProviderOf } from './ai-provider';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

export interface AiTextPart {
  type: 'text';
  text: string;
}

export interface AiImagePart {
  type: 'image';
  url: string;
  detail: 'low' | 'high';
}

export type AiContentPart = AiTextPart | AiImagePart;

export interface AiSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface AiStructuredRequest {
  system: string;
  content: AiContentPart[];
  schema: AiSchema;
  maxOutputTokens?: number;
}

export interface AiTokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface AiCompletion {
  output: unknown;
  usage: AiTokenUsage | null;
}

export interface AiClient {
  readonly model: string;
  readonly provider: AiProvider;
  structured(request: AiStructuredRequest): Promise<AiCompletion>;
}

export class AiRequestError extends BadGatewayException {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class UnusableAnswerError extends AiRequestError {
  constructor(
    message: string,
    retryable: boolean,
    readonly usage: AiTokenUsage | null,
  ) {
    super(message, retryable);
  }
}

const KEY_PATTERN = /sk-[A-Za-z0-9_-]+/g;
const QUOTA_CODE = 'insufficient_quota';
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 409]);
const MIN_SERVER_ERROR_STATUS = 500;

const retryableStatus = (status: unknown): boolean =>
  typeof status === 'number' &&
  (RETRYABLE_STATUSES.has(status) || status >= MIN_SERVER_ERROR_STATUS);

const redact = (text: string): string =>
  text.replace(KEY_PATTERN, '[redacted]');

const apiField = (error: APIError, field: string): string | null => {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const value: unknown = Reflect.get(body, field);
  return typeof value === 'string' ? value : null;
};

const apiMessage = (error: APIError): string => {
  const detail = apiField(error, 'message');
  return detail === null ? 'no details' : redact(detail);
};

export const classifyRequestError = (
  error: unknown,
  model: string,
  provider: AiProvider = 'openai',
): AiRequestError => {
  const { name, inSentence, key, account } = AI_PROVIDER_WORDING[provider];
  if (error instanceof AuthenticationError) {
    return new AiRequestError(
      `${name} rejected the API key. Check OPENAI_API_KEY.`,
      false,
    );
  }
  if (error instanceof PermissionDeniedError) {
    return new AiRequestError(`${key} cannot use ${model}.`, false);
  }
  if (error instanceof NotFoundError) {
    return new AiRequestError(
      `${name} does not offer the model ${model}. Check AI_MODEL.`,
      false,
    );
  }
  if (error instanceof BadRequestError) {
    return new AiRequestError(
      `${name} refused the request: ${apiMessage(error)}`,
      false,
    );
  }
  if (error instanceof RateLimitError) {
    return apiField(error, 'code') === QUOTA_CODE
      ? new AiRequestError(`${account} has no remaining quota.`, false)
      : new AiRequestError(`${name} is rate limiting requests.`, true);
  }
  if (error instanceof InternalServerError) {
    return new AiRequestError(`${name} had an internal error.`, true);
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new AiRequestError(`${name} did not answer in time.`, true);
  }
  if (error instanceof APIConnectionError) {
    return new AiRequestError(`Could not reach ${inSentence}.`, true);
  }
  return new AiRequestError(
    `${name} request failed.`,
    error instanceof APIError && retryableStatus(error.status),
  );
};

const withoutSecret = (
  failure: AiRequestError,
  secret: string,
): AiRequestError => {
  const message = scrubText(failure.message, [secret]);
  return message === failure.message
    ? failure
    : new AiRequestError(message, failure.retryable);
};

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const WITHOUT_OPENAI_ACCOUNT = { organization: null, project: null } as const;

const toContentPart = (
  part: AiContentPart,
): OpenAI.Chat.Completions.ChatCompletionContentPart =>
  part.type === 'text'
    ? { type: 'text', text: part.text }
    : {
        type: 'image_url',
        image_url: { url: part.url, detail: part.detail },
      };

const usageOf = (
  completion: OpenAI.Chat.Completions.ChatCompletion,
): AiTokenUsage | null =>
  completion.usage
    ? {
        inputTokens: completion.usage.prompt_tokens,
        cachedInputTokens:
          completion.usage.prompt_tokens_details?.cached_tokens ?? 0,
        outputTokens: completion.usage.completion_tokens,
      }
    : null;

class OpenAiClient implements AiClient {
  constructor(
    private readonly openai: OpenAI,
    readonly model: string,
    readonly provider: AiProvider,
    private readonly secret: string,
  ) {}

  async structured(request: AiStructuredRequest): Promise<AiCompletion> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.system },
      { role: 'user', content: request.content.map(toContentPart) },
    ];

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        max_completion_tokens:
          request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.schema.name,
            schema: request.schema.schema,
            strict: true,
          },
        },
      });
    } catch (error) {
      throw withoutSecret(
        classifyRequestError(error, this.model, this.provider),
        this.secret,
      );
    }

    const { name } = AI_PROVIDER_WORDING[this.provider];
    const usage = usageOf(completion);
    const choice = completion.choices[0];
    if (!choice) {
      throw new UnusableAnswerError(
        `${name} returned no choices.`,
        true,
        usage,
      );
    }
    if (choice.message.refusal) {
      throw new UnusableAnswerError(
        `${name} refused to analyze this listing.`,
        false,
        usage,
      );
    }
    if (choice.finish_reason === 'length') {
      throw new UnusableAnswerError(
        'The model ran out of output tokens.',
        false,
        usage,
      );
    }
    if (choice.finish_reason === 'content_filter') {
      throw new UnusableAnswerError(
        `${name} filtered the response.`,
        false,
        usage,
      );
    }
    const content = choice.message.content;
    if (!content) {
      throw new UnusableAnswerError(
        `${name} returned an empty response.`,
        true,
        usage,
      );
    }
    try {
      return { output: JSON.parse(content) as unknown, usage };
    } catch {
      throw new UnusableAnswerError(
        `${name} returned an unreadable response.`,
        true,
        usage,
      );
    }
  }
}

const configuredBaseUrl = (
  config: ConfigService<Env, true>,
): string | undefined =>
  config.get('OPENAI_BASE_URL', { infer: true })?.trim() || undefined;

export function createOpenAiClient(
  config: ConfigService<Env, true>,
): AiClient | null {
  const apiKey = config.get('OPENAI_API_KEY', { infer: true });
  if (!apiKey) {
    return null;
  }
  const model = config.get('AI_MODEL', { infer: true });
  const baseURL = configuredBaseUrl(config);
  const provider = aiProviderOf(baseURL);
  return new OpenAiClient(
    new OpenAI({
      apiKey,
      baseURL: baseURL ?? null,
      ...(provider === 'compatible' ? WITHOUT_OPENAI_ACCOUNT : {}),
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    }),
    model,
    provider,
    apiKey,
  );
}
