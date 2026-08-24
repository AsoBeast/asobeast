import { UnrecoverableError, type Job } from 'bullmq';
import type { WorkspaceScope } from '../common/tenancy/workspace-context';

export interface WorkspaceJobPayload {
  workspaceId: string;
  correlationId?: string;
}

export class JobWorkspaceMissingError extends UnrecoverableError {
  constructor(name: string, id: string) {
    super(
      `Job ${name} #${id} carries no workspaceId; drain the queues before upgrading`,
    );
    this.name = 'JobWorkspaceMissingError';
  }
}

export function requireJobWorkspace(job: Pick<Job, 'name' | 'id' | 'data'>) {
  const data = job.data as Partial<WorkspaceJobPayload> | undefined;
  const workspaceId = data?.workspaceId;
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    throw new JobWorkspaceMissingError(job.name, job.id ?? 'unknown');
  }
  return workspaceId;
}

export function requireJobScope(
  job: Pick<Job, 'name' | 'id' | 'data'>,
): WorkspaceScope {
  const data = job.data as Partial<WorkspaceJobPayload> | undefined;
  return {
    workspaceId: requireJobWorkspace(job),
    correlationId: data?.correlationId,
  };
}
