import { normalizeIp } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../auth.types';

const UNKNOWN_CLIENT = 'unknown';

export function trackerOf(req: Record<string, unknown>): string {
  const { user } = req as AuthenticatedRequest;
  if (user) return `ws:${user.workspaceId}`;
  const ip =
    typeof req.ip === 'string' && req.ip.length > 0
      ? normalizeIp(req.ip)
      : null;
  return `ip:${ip ?? UNKNOWN_CLIENT}`;
}
