import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Env } from '../config/env';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

export interface AiTextPart {
  type: 'text';
  text: string;
}

export interface AiImagePart {
  type: 'image';
  url: string;
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

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toContentPart = (
  part: AiContentPart,
): OpenAI.Chat.Completions.ChatCompletionContentPart =>
  part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image_url', image_url: { url: part.url } };

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
      throw new BadGatewayException(
        `OpenAI request failed: ${messageOf(error)}`,
      );
    }

    const choice = completion.choices[0];
    if (!choice) {
      throw new BadGatewayException('OpenAI returned no choices');
    }
    if (choice.message.refusal) {
      throw new BadGatewayException(
        `OpenAI refused the request: ${choice.message.refusal}`,
      );
    }
    if (choice.finish_reason !== 'stop') {
      throw new BadGatewayException(
        `OpenAI stopped early (${choice.finish_reason}); the response may be incomplete`,
      );
    }
    const content = choice.message.content;
    if (!content) {
      throw new BadGatewayException('OpenAI returned empty content');
    }
    try {
      return JSON.parse(content);
    } catch {
      throw new BadGatewayException('OpenAI returned invalid JSON');
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
