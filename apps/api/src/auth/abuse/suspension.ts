import type { RateClass } from '@asobeast/shared';
import type { AuthCredential } from '../auth.types';

export interface SuspendedWorkspace {
  suspendedAt: Date | null;
}

export interface SuspendedRequest {
  credential: AuthCredential | undefined;
  rateClass: RateClass;
  allowedWhileUnentitled: boolean;
}

export function refusesWhileSuspended(
  workspace: SuspendedWorkspace,
  req: SuspendedRequest,
): boolean {
  if (workspace.suspendedAt === null) return false;
  if (req.allowedWhileUnentitled) return false;
  if (req.credential !== 'session') return true;
  return req.rateClass !== 'read';
}
