import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

interface WorkspaceStore {
  workspaceId?: string;
  correlationId?: string;
  crossTenant?: true;
}

export interface WorkspaceScope {
  workspaceId: string;
  correlationId?: string;
}

export class WorkspaceContextMissingError extends Error {
  constructor(operation: string) {
    super(`No workspace in scope for ${operation}`);
    this.name = 'WorkspaceContextMissingError';
  }
}

@Injectable()
export class WorkspaceContext {
  private readonly storage = new AsyncLocalStorage<WorkspaceStore>();

  openScope(callback: () => void): void {
    this.storage.run({}, callback);
  }

  run<T>(workspaceId: string, work: () => Promise<T>): Promise<T> {
    return this.runScope({ workspaceId }, work);
  }

  runScope<T>(scope: WorkspaceScope, work: () => Promise<T>): Promise<T> {
    return this.storage.run(
      {
        workspaceId: scope.workspaceId,
        correlationId:
          scope.correlationId ?? this.correlationId ?? randomUUID(),
      },
      async () => {
        const result = await work();
        return result;
      },
    );
  }

  runCrossTenant<T>(work: () => Promise<T>): Promise<T> {
    const correlationId = this.correlationId ?? randomUUID();
    return this.storage.run({ crossTenant: true, correlationId }, async () => {
      const result = await work();
      return result;
    });
  }

  bind(workspaceId: string): void {
    const store = this.storage.getStore();
    if (!store) throw new WorkspaceContextMissingError('this request');
    store.workspaceId = workspaceId;
  }

  correlate(correlationId: string): void {
    const store = this.storage.getStore();
    if (!store) throw new WorkspaceContextMissingError('this request');
    store.correlationId = correlationId;
  }

  get current(): string | undefined {
    return this.storage.getStore()?.workspaceId;
  }

  get correlationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  get crossTenant(): boolean {
    return this.storage.getStore()?.crossTenant === true;
  }

  require(operation: string): string {
    const workspaceId = this.current;
    if (!workspaceId) throw new WorkspaceContextMissingError(operation);
    return workspaceId;
  }

  scopeFor(operation: string): WorkspaceScope {
    return {
      workspaceId: this.require(operation),
      correlationId: this.correlationId,
    };
  }
}
