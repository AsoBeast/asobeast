import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { IsolationMonitor } from '../common/tenancy/isolation-monitor.service';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { Env } from '../config/env';

type RawClient = Pick<PrismaClient, '$executeRaw'>;

function enterScope(client: RawClient, workspace: WorkspaceContext) {
  return workspace.crossTenant
    ? client.$executeRaw`SELECT app_enter_cross_tenant()`
    : client.$executeRaw`SELECT app_enter_workspace(${workspace.current ?? ''})`;
}

function createPrismaClient(
  connectionString: string,
  workspace: WorkspaceContext,
  isolation: IsolationMonitor,
) {
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  return base.$extends({
    client: {
      async onModuleInit(): Promise<void> {
        await base.$connect();
      },
      async onModuleDestroy(): Promise<void> {
        await base.$disconnect();
      },
      withTransaction<T>(
        run: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
      ): Promise<T> {
        return base.$transaction(async (tx) => {
          await enterScope(tx, workspace);
          return run(tx);
        }, options);
      },
    },
    query: {
      $allModels: { $allOperations: watched },
      $queryRaw: watched,
      $executeRaw: scoped,
      $queryRawUnsafe: watched,
      $executeRawUnsafe: scoped,
    },
  });

  async function scoped<A, R>({
    args,
    query,
  }: {
    args: A;
    query: (args: A) => Prisma.PrismaPromise<R>;
  }): Promise<R> {
    const [, result] = await base.$transaction([
      enterScope(base, workspace),
      query(args),
    ]);
    return result;
  }

  async function watched<A, R>(params: {
    args: A;
    query: (args: A) => Prisma.PrismaPromise<R>;
    model?: string;
    operation: string;
  }): Promise<R> {
    const result = await scoped(params);
    const workspaceId = workspace.current;
    if (workspaceId && !workspace.crossTenant) {
      isolation.inspect(
        `${params.model ?? 'raw'}.${params.operation}`,
        workspaceId,
        result,
      );
    }
    return result;
  }
}

const ExtendedPrismaClient = class {
  constructor(
    config: ConfigService<Env, true>,
    workspace: WorkspaceContext,
    isolation: IsolationMonitor,
  ) {
    return createPrismaClient(
      config.get('DATABASE_URL', { infer: true }),
      workspace,
      isolation,
    );
  }
} as new (
  config: ConfigService<Env, true>,
  workspace: WorkspaceContext,
  isolation: IsolationMonitor,
) => ReturnType<typeof createPrismaClient>;

@Injectable()
export class PrismaService extends ExtendedPrismaClient {
  constructor(
    config: ConfigService<Env, true>,
    workspace: WorkspaceContext,
    isolation: IsolationMonitor,
  ) {
    super(config, workspace, isolation);
  }
}
