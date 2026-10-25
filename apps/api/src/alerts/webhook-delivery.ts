import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetch, type Dispatcher, type Response } from 'undici';
import {
  AlertPayload,
  webhookLabel,
  WebhookTestResult,
} from '@asobeast/shared';
import { Env } from '../config/env';
import { formatWebhookBody } from './webhook-format';
import { deliveryHeaders } from './webhook-signature';
import { publicOnlyDispatcher } from './webhook-dispatcher';
import {
  assertDeliverableUrl,
  type WebhookTargetOptions,
} from './webhook-target';

const TIMEOUT_MS = 10_000;
const TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_DEFAULT_MS = 5_000;
const RETRY_AFTER_MAX_MS = 15 * 60_000;

export class WebhookRateLimitedError extends Error {
  constructor(
    readonly retryAfterMs: number,
    target: string,
  ) {
    super(`${target} asked to retry after ${Math.ceil(retryAfterMs / 1000)} s`);
    this.name = 'WebhookRateLimitedError';
  }
}

const RETRY_BODY_MAX_BYTES = 4096;
const RETRY_BODY_READ_MS = 1_000;

interface DeliveryAnswer {
  ok: boolean;
  status: number;
  retryAfterMs: number;
}

const boundedWait = (millis: number): number =>
  Math.min(
    Number.isFinite(millis) && millis > 0 ? millis : RETRY_AFTER_DEFAULT_MS,
    RETRY_AFTER_MAX_MS,
  );

function headerWaitMs(header: string | null, now = Date.now()): number {
  const seconds = Number(header);
  return header !== null && Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : Date.parse(header ?? '') - now;
}

async function readBounded(response: Response, max: number): Promise<string> {
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined =
    response.body?.getReader();
  if (!reader) return '';
  const deadline = setTimeout(
    () => void reader.cancel().catch(() => undefined),
    RETRY_BODY_READ_MS,
  );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    return '';
  } finally {
    clearTimeout(deadline);
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).subarray(0, max).toString('utf8');
}

function bodyRetryAfterSeconds(text: string): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  if (!('parameters' in parsed)) return null;
  const { parameters } = parsed;
  if (typeof parameters !== 'object' || parameters === null) return null;
  return 'retry_after' in parameters &&
    typeof parameters.retry_after === 'number'
    ? parameters.retry_after
    : null;
}

async function retryAfterMsOf(response: Response): Promise<number> {
  const seconds = bodyRetryAfterSeconds(
    await readBounded(response, RETRY_BODY_MAX_BYTES),
  );
  return boundedWait(
    seconds !== null
      ? seconds * 1000
      : headerWaitMs(response.headers.get('retry-after')),
  );
}

@Injectable()
export class WebhookDelivery implements OnModuleDestroy {
  private readonly target: WebhookTargetOptions;
  private readonly dispatcher: Dispatcher;
  private readonly origin: string | null;

  constructor(config: ConfigService<Env, true>) {
    this.origin = config.get('WEB_PUBLIC_URL', { infer: true }) ?? null;
    this.target = {
      allowPrivate: config.get('WEBHOOK_ALLOW_PRIVATE_TARGETS', {
        infer: true,
      }),
    };
    this.dispatcher = publicOnlyDispatcher(this.target);
  }

  onModuleDestroy(): Promise<void> {
    return this.dispatcher.close();
  }

  assertTarget(url: string): void {
    assertDeliverableUrl(url, this.target);
  }

  async send(
    url: string,
    secret: string | null,
    payload: AlertPayload,
  ): Promise<void> {
    const response = await this.post(url, secret, payload);
    if (response.status === TOO_MANY_REQUESTS) {
      throw new WebhookRateLimitedError(
        response.retryAfterMs,
        webhookLabel(url),
      );
    }
    if (!response.ok) {
      throw new Error(
        `Webhook ${webhookLabel(url)} responded ${response.status}`,
      );
    }
  }

  async attempt(
    url: string,
    secret: string | null,
    payload: AlertPayload,
  ): Promise<WebhookTestResult> {
    try {
      const response = await this.post(url, secret, payload);
      return { delivered: response.ok, status: response.status };
    } catch {
      return { delivered: false, status: null };
    }
  }

  private async post(
    url: string,
    secret: string | null,
    payload: AlertPayload,
  ): Promise<DeliveryAnswer> {
    const target = assertDeliverableUrl(url, this.target);
    const body = formatWebhookBody(url, payload, this.origin);
    const response = await fetch(target, {
      method: 'POST',
      headers: deliveryHeaders(payload.event, body, secret),
      body,
      dispatcher: this.dispatcher,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const retryAfterMs =
      response.status === TOO_MANY_REQUESTS
        ? await retryAfterMsOf(response)
        : 0;
    await response.body?.cancel().catch(() => undefined);
    return { ok: response.ok, status: response.status, retryAfterMs };
  }
}
