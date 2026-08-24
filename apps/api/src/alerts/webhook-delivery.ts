import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetch, type Dispatcher, type Response } from 'undici';
import { AlertPayload, WebhookTestResult } from '@asobeast/shared';
import { Env } from '../config/env';
import { formatWebhookBody } from './webhook-format';
import { deliveryHeaders } from './webhook-signature';
import { publicOnlyDispatcher } from './webhook-dispatcher';
import {
  assertDeliverableUrl,
  type WebhookTargetOptions,
} from './webhook-target';

const TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookDelivery implements OnModuleDestroy {
  private readonly target: WebhookTargetOptions;
  private readonly dispatcher: Dispatcher;

  constructor(config: ConfigService<Env, true>) {
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
    if (!response.ok) {
      throw new Error(`Webhook ${url} responded ${response.status}`);
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
    const body = formatWebhookBody(url, payload);
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
