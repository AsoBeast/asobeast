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
import { Env } from '../config/env';

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

export interface AiClient {
  readonly model: string;
  structured(request: AiStructuredRequest): Promise<unknown>;
}

export class AiRequestError extends BadGatewayException {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
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
): AiRequestError => {
  if (error instanceof AuthenticationError) {
    return new AiRequestError(
      'OpenAI rejected the API key. Check OPENAI_API_KEY.',
      false,
    );
  }
  if (error instanceof PermissionDeniedError) {
    return new AiRequestError(`The OpenAI key cannot use ${model}.`, false);
  }
  if (error instanceof NotFoundError) {
    return new AiRequestError(
      `OpenAI does not offer the model ${model}. Check AI_MODEL.`,
      false,
    );
  }
  if (error instanceof BadRequestError) {
    return new AiRequestError(
      `OpenAI refused the request: ${apiMessage(error)}`,
      false,
    );
  }
  if (error instanceof RateLimitError) {
    return apiField(error, 'code') === QUOTA_CODE
      ? new AiRequestError('The OpenAI account has no remaining quota.', false)
      : new AiRequestError('OpenAI is rate limiting requests.', true);
  }
  if (error instanceof InternalServerError) {
    return new AiRequestError('OpenAI had an internal error.', true);
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new AiRequestError('OpenAI did not answer in time.', true);
  }
  if (error instanceof APIConnectionError) {
    return new AiRequestError('Could not reach OpenAI.', true);
  }
  return new AiRequestError(
    'OpenAI request failed.',
    error instanceof APIError && retryableStatus(error.status),
  );
};

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

const toContentPart = (
  part: AiContentPart,
): OpenAI.Chat.Completions.ChatCompletionContentPart =>
  part.type === 'text'
    ? { type: 'text', text: part.text }
    : {
        type: 'image_url',
        image_url: { url: part.url, detail: part.detail },
      };

class OpenAiClient implements AiClient {
  constructor(
    private readonly openai: OpenAI,
    readonly model: string,
  ) {}

  async structured(request: AiStructuredRequest): Promise<unknown> {
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
      throw classifyRequestError(error, this.model);
    }

    const choice = completion.choices[0];
    if (!choice) {
      throw new AiRequestError('OpenAI returned no choices.', true);
    }
    if (choice.message.refusal) {
      throw new AiRequestError(
        'OpenAI refused to analyze this listing.',
        false,
      );
    }
    if (choice.finish_reason === 'length') {
      throw new AiRequestError('The model ran out of output tokens.', false);
    }
    if (choice.finish_reason === 'content_filter') {
      throw new AiRequestError('OpenAI filtered the response.', false);
    }
    const content = choice.message.content;
    if (!content) {
      throw new AiRequestError('OpenAI returned an empty response.', true);
    }
    try {
      return JSON.parse(content);
    } catch {
      throw new AiRequestError('OpenAI returned an unreadable response.', true);
    }
  }
}

export function createOpenAiClient(
  config: ConfigService<Env, true>,
): AiClient | null {
  const apiKey = config.get('OPENAI_API_KEY', { infer: true });
  if (!apiKey) {
    return null;
  }
  const model = config.get('AI_MODEL', { infer: true });
  return new OpenAiClient(
    new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    }),
    model,
  );
}
