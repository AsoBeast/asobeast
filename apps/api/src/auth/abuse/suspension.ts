import type { RateClass } from '@asobeast/shared';
import type { AuthCredential } from '../auth.types';

export interface SuspendedWorkspace {
  suspendedAt: Date | null;
}

export interface SuspendedRequest {
  credential: AuthCredential | undefined;
  rateClass: RateClass;
  allowedWhileUnentitled: boolean;
  exportsWorkspaceData: boolean;
}

export function refusesWhileSuspended(
  workspace: SuspendedWorkspace,
  req: SuspendedRequest,
): boolean {
  if (workspace.suspendedAt === null) return false;
  if (req.credential !== 'session') return !req.exportsWorkspaceData;
  if (req.allowedWhileUnentitled) return false;
  return req.rateClass !== 'read';
}
