import { Injectable, Logger } from '@nestjs/common';
import { foreignWorkspaces } from './isolation-anomaly';

export interface IsolationAnomaly {
  operation: string;
  workspaceId: string;
  foreign: string[];
  seenAt: Date;
}

@Injectable()
export class IsolationMonitor {
  private readonly logger = new Logger(IsolationMonitor.name);
  private count = 0;
  private last: IsolationAnomaly | null = null;

  inspect(operation: string, workspaceId: string, result: unknown): void {
    const foreign = foreignWorkspaces(result, workspaceId);
    if (foreign.length === 0) return;

    this.count += 1;
    this.last = { operation, workspaceId, foreign, seenAt: new Date() };
    this.logger.error(
      `isolation anomaly: ${operation} scoped to ${workspaceId} returned rows owned by ${foreign.join(', ')}`,
    );
  }

  get anomalies(): number {
    return this.count;
  }

  get lastAnomaly(): IsolationAnomaly | null {
    return this.last;
  }
}
