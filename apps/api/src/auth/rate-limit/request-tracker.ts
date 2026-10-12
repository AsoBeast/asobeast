import { normalizeIp } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../auth.types';

const UNKNOWN_CLIENT = 'ip:unknown';

export function addressTrackerOf(req: { ip?: unknown }): string | null {
  return typeof req.ip === 'string' && req.ip.length > 0
    ? `ip:${normalizeIp(req.ip)}`
    : null;
}

export function trackerOf(req: Record<string, unknown>): string {
  const { user } = req as AuthenticatedRequest;
  if (user) return `ws:${user.workspaceId}`;
  return addressTrackerOf(req) ?? UNKNOWN_CLIENT;
}
