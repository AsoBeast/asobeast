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

function retryAfterMsOf(header: string | null, now = Date.now()): number {
  const seconds = Number(header);
  const wait =
    header !== null && Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000
      : Date.parse(header ?? '') - now;
  return Math.min(
    Number.isFinite(wait) && wait > 0 ? wait : RETRY_AFTER_DEFAULT_MS,
    RETRY_AFTER_MAX_MS,
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
        retryAfterMsOf(response.headers.get('retry-after')),
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
  ): Promise<Response> {
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

    await response.body?.cancel().catch(() => undefined);
    return response;
  }
}
