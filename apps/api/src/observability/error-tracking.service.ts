import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { Env } from '../config/env';
import { reportingDsn } from './error-reporting';

const GATE_CLOSED =
  'ERROR_TRACKING_DSN is set but error reporting stays off. It also needs NODE_ENV=production and BILLING_ENABLED=true, so a self hosted deployment never reports errors outside itself.';

export interface ErrorContext {
  transaction?: string;
  tags?: Record<string, string>;
}

@Injectable()
export class ErrorTracking implements OnModuleInit {
  private readonly logger = new Logger(ErrorTracking.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly workspace: WorkspaceContext,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('ERROR_TRACKING_DSN', { infer: true })) return;
    if (this.enabled) {
      this.logger.log('error reporting is on');
      return;
    }
    this.logger.warn(GATE_CLOSED);
  }

  get enabled(): boolean {
    return (
      reportingDsn({
        dsn: this.config.get('ERROR_TRACKING_DSN', { infer: true }),
        nodeEnv: this.config.get('NODE_ENV', { infer: true }),
        billingEnabled: this.config.get('BILLING_ENABLED', { infer: true }),
      }) !== null
    );
  }

  capture(error: unknown, context: ErrorContext = {}): void {
    if (!this.enabled) return;
    Sentry.withScope((scope) => {
      scope.setTags({ ...this.scopeTags(), ...context.tags });
      if (context.transaction) scope.setTransactionName(context.transaction);
      Sentry.captureException(error);
    });
  }

  private scopeTags(): Record<string, string> {
    const { current, correlationId } = this.workspace;
    return {
      ...(current ? { workspace: current } : {}),
      ...(correlationId ? { correlation: correlationId } : {}),
    };
  }
}
