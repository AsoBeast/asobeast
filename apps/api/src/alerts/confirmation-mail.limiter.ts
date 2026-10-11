import { Injectable } from '@nestjs/common';
import { sha256 } from '../auth/password-hash';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { secondsUntilReset, windowKey } from '../auth/rate-limit/window';
import { FailFastRedis } from '../redis/fail-fast-redis';

export const CONFIRMATIONS_PER_RECIPIENT_PER_DAY = 5;

export const CONFIRMATIONS_PER_WORKSPACE_PER_DAY = 20;

const DAY_SECONDS = 24 * 60 * 60;

interface Allowance {
  label: string;
  scope: string;
  limit: number;
  reason: string;
}

@Injectable()
export class ConfirmationMailLimiter {
  constructor(private readonly redis: FailFastRedis) {}

  async claim(
    workspaceId: string,
    address: string,
    now = new Date(),
  ): Promise<void> {
    const allowances: Allowance[] = [
      {
        label: 'recipient',
        scope: sha256(address.toLowerCase()),
        limit: CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
        reason:
          'Too many confirmation emails were requested for this recipient today.',
      },
      {
        label: 'workspace',
        scope: workspaceId,
        limit: CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
        reason:
          'Too many confirmation emails were requested from this workspace today.',
      },
    ];
    for (const allowance of allowances) {
      if ((await this.count(allowance, now)) > allowance.limit) {
        throw new RequestThrottledError(
          secondsUntilReset(DAY_SECONDS, now),
          allowance.reason,
        );
      }
    }
  }

  private count({ label, scope }: Allowance, now: Date): Promise<number> {
    const key = windowKey('confirmation', scope, label, DAY_SECONDS, now);
    return this.redis.run(async (client) => {
      const hits = await client.incr(key);
      if (hits === 1) await client.expire(key, DAY_SECONDS);
      return hits;
    });
  }
}
