import {
  Injectable,
  Logger,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createMcpHandler,
  type McpHttpHandler,
  type McpRequestContext,
} from '@modelcontextprotocol/server';
import {
  toNodeHandler,
  type NodeMcpRequestHandler,
} from '@modelcontextprotocol/node';
import type { Request } from 'express';
import { apiVersion } from '../api-version';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { planScopeOf } from '../auth/plan-limits';
import { RequestRateLimiter } from '../auth/rate-limit/request-rate.limiter';
import { scrubText } from '../common/logging/log-redaction';
import { secretLiterals } from '../common/logging/logger-options';
import type { Env } from '../config/env';
import { InProcessGateway } from './in-process.gateway';
import { createRemoteServer, urlOf } from './remote-tools';

function authorization(
  request: McpRequestContext['requestInfo'],
): Record<string, string | undefined> {
  return { authorization: request?.headers.get('authorization') ?? undefined };
}

@Injectable()
export class McpBridge implements OnModuleDestroy {
  private readonly logger = new Logger(McpBridge.name);
  private readonly secrets: string[];
  private readonly handler: McpHttpHandler;
  readonly serve: NodeMcpRequestHandler;

  constructor(
    private readonly gateway: InProcessGateway,
    private readonly limiter: RequestRateLimiter,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.secrets = secretLiterals(config);
    this.handler = createMcpHandler(
      ({ requestInfo }) =>
        createRemoteServer(apiVersion(), (request) =>
          this.gateway.get(urlOf(request), authorization(requestInfo)),
        ),
      {
        legacy: 'stateless',
        onerror: (error) =>
          this.logger.warn(
            `the mcp endpoint refused a request: ${this.sanitized(error)}`,
          ),
      },
    );
    this.serve = toNodeHandler(this.handler, {
      onerror: (error) =>
        this.logger.error(
          `the mcp transport failed: ${this.sanitized(error)}`,
          scrubText(error.stack ?? '', this.secrets),
        ),
    });
  }

  onModuleDestroy(): Promise<void> {
    return this.handler.close();
  }

  async admit(req: Request): Promise<void> {
    const { user, credential } = req as Request & AuthenticatedRequest;
    if (credential !== 'token') {
      throw new UnauthorizedException(
        'The MCP endpoint accepts a personal API token only. Send it as an Authorization Bearer header.',
      );
    }
    if (!user) return;

    const metered = this.config.get('BILLING_ENABLED', { infer: true });
    const { plan, limits } = planScopeOf(metered, user.workspace, new Date());
    await this.limiter.consumeMcp({
      workspaceId: user.workspaceId,
      plan,
      limits,
    });
  }

  private sanitized(error: Error): string {
    return scrubText(`${error.name}: ${error.message}`, this.secrets);
  }
}
