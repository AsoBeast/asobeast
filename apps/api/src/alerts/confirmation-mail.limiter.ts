import { Injectable, Logger } from '@nestjs/common';
import { sha256 } from '../auth/password-hash';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { secondsUntilReset, windowKey } from '../auth/rate-limit/window';
import { FailFastRedis } from '../redis/fail-fast-redis';

export const CONFIRMATIONS_PER_RECIPIENT_PER_DAY = 5;

export const CONFIRMATIONS_PER_WORKSPACE_PER_DAY = 20;

const DAY_SECONDS = 24 * 60 * 60;

const CLAIM_EVERY_ALLOWANCE = `
for index, key in ipairs(KEYS) do
  if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[index]) then
    return index
  end
end
for _, key in ipairs(KEYS) do
  redis.call('INCR', key)
  redis.call('EXPIRE', key, ARGV[#KEYS + 1])
end
return 0
`;

const REFUND_EVERY_ALLOWANCE = `
for _, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then
    redis.call('DECR', key)
  end
end
return 0
`;

export type ConfirmationRefund = () => Promise<void>;

interface Allowance {
  label: string;
  scope: string;
  limit: number;
  reason: string;
}

@Injectable()
export class ConfirmationMailLimiter {
  private readonly logger = new Logger(ConfirmationMailLimiter.name);

  constructor(private readonly redis: FailFastRedis) {}

  async claim(
    workspaceId: string,
    address: string,
    now = new Date(),
  ): Promise<ConfirmationRefund> {
    const allowances: Allowance[] = [
      {
        label: 'workspace',
        scope: workspaceId,
        limit: CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
        reason:
          'Too many confirmation emails were requested from this workspace today.',
      },
      {
        label: 'recipient',
        scope: sha256(address.toLowerCase()),
        limit: CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
        reason:
          'Too many confirmation emails were requested for this recipient today.',
      },
    ];
    const keys = allowances.map(({ label, scope }) =>
      windowKey('confirmation', scope, label, DAY_SECONDS, now),
    );
    const resetSeconds = secondsUntilReset(DAY_SECONDS, now);
    const refused = await this.redis.run((client) =>
      client.eval(
        CLAIM_EVERY_ALLOWANCE,
        keys.length,
        ...keys,
        ...allowances.map(({ limit }) => limit),
        resetSeconds,
      ),
    );
    const spent = allowances[Number(refused) - 1];
    if (spent) {
      throw new RequestThrottledError(resetSeconds, spent.reason);
    }
    let refunded = false;
    return async () => {
      if (refunded) return;
      refunded = true;
      await this.refund(keys);
    };
  }

  private async refund(keys: string[]): Promise<void> {
    try {
      await this.redis.runOpen(
        (client) => client.eval(REFUND_EVERY_ALLOWANCE, keys.length, ...keys),
        null,
      );
    } catch (error) {
      this.logger.warn(
        `confirmation allowance refund failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
