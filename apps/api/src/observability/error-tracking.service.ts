import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { secretLiterals } from '../common/logging/logger-options';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { apiVersion } from '../api-version';
import type { Env } from '../config/env';
import {
  InvalidErrorTrackingDsnError,
  parseErrorTrackingDsn,
  type ErrorTrackingTarget,
} from './error-dsn';
import { errorEvent } from './error-event';

const SEND_TIMEOUT_MS = 3_000;
const CLIENT = 'asobeast';

export interface ErrorContext {
  method?: string;
  path?: string;
}

@Injectable()
export class ErrorTracking implements OnModuleInit {
  private readonly logger = new Logger(ErrorTracking.name);
  private target: ErrorTrackingTarget | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly workspace: WorkspaceContext,
  ) {}

  onModuleInit(): void {
    const dsn = this.config.get('ERROR_TRACKING_DSN', { infer: true });
    if (!dsn) return;

    if (!this.config.get('BILLING_ENABLED', { infer: true })) {
      this.logger.warn(
        'ERROR_TRACKING_DSN is set with BILLING_ENABLED false. Error tracking stays off: a self hosted deployment never reports errors outside itself.',
      );
      return;
    }

    try {
      this.target = parseErrorTrackingDsn(dsn);
      this.logger.log(
        `error tracking reports to project ${this.target.projectId}`,
      );
    } catch (error) {
      if (!(error instanceof InvalidErrorTrackingDsnError)) throw error;
      this.logger.error(error.message);
    }
  }

  get enabled(): boolean {
    return this.target !== null;
  }

  capture(error: unknown, context: ErrorContext = {}): void {
    if (!this.target) return;

    const eventId = randomUUID().replace(/-/g, '');
    const event = errorEvent(
      error,
      {
        secrets: secretLiterals(this.config),
        environment: this.config.get('NODE_ENV', { infer: true }),
        release: apiVersion(),
        workspaceId: this.workspace.current,
        correlationId: this.workspace.correlationId,
        ...context,
      },
      eventId,
      new Date(),
    );

    void this.send(this.target, event, eventId).catch((failure: unknown) => {
      this.logger.warn(
        `error tracking did not accept an event: ${(failure as Error).message}`,
      );
    });
  }

  private async send(
    target: ErrorTrackingTarget,
    event: unknown,
    eventId: string,
  ): Promise<void> {
    const body = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(event),
    ].join('\n');

    await request(target.envelopeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_client=${CLIENT}/${apiVersion()}, sentry_key=${target.publicKey}`,
      },
      body,
      headersTimeout: SEND_TIMEOUT_MS,
      bodyTimeout: SEND_TIMEOUT_MS,
    });
  }
}
