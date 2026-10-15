import type { OnDemandAction, RateLimitDetail } from '@asobeast/shared';
import { describeWait } from './describe-wait';

const WINDOW_NAMES: Record<RateLimitDetail['window'], string> = {
  minute: 'per minute',
  hour: 'per hour',
  day: 'per day',
  concurrent: 'in parallel',
};

const ON_DEMAND_LABELS: Record<OnDemandAction, string> = {
  refresh: 'Refresh',
  runDaily: 'Run daily',
  score: 'Score',
  suggestions: 'Keyword suggestions',
  spider: 'Deep search',
  importApp: 'Import app',
  addCompetitor: 'Add competitor',
  storeLookup: 'Store lookup',
};

function onDemandMessage(
  action: OnDemandAction,
  detail: RateLimitDetail,
): string {
  return `${ON_DEMAND_LABELS[action]} limit reached: the ${detail.plan} plan allows ${detail.limit} requests ${WINDOW_NAMES[detail.window]}. Try again in ${describeWait(detail.resetSeconds)}.`;
}

export function rateLimitMessage(
  detail: RateLimitDetail,
  requests = `${detail.rateClass} requests`,
): string {
  if (detail.action) return onDemandMessage(detail.action, detail);
  const allowance = `the ${detail.plan} plan allows ${detail.limit} ${requests} ${WINDOW_NAMES[detail.window]}`;
  const reopens =
    detail.window === 'concurrent'
      ? 'Send fewer requests at once'
      : `Wait ${detail.resetSeconds} seconds before the next one, because retrying before then will fail`;
  return `Rate limit reached: ${allowance}. ${reopens}.`;
}

export const MCP_REQUESTS = 'MCP requests';

export function oversizedBatchMessage(
  detail: RateLimitDetail,
  messages: number,
): string {
  return `MCP batch too large: it carries ${messages} messages and the ${detail.plan} plan allows ${detail.limit} ${MCP_REQUESTS} ${WINDOW_NAMES[detail.window]}, so it can never be served. Split it into requests of at most ${detail.limit} messages.`;
}

export class CredentialRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `Too many rejected credentials from this address. Wait ${retryAfterSeconds} seconds before presenting another one.`,
    );
    this.name = 'CredentialRateLimitError';
  }
}

export class RequestThrottledError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    reason = 'Too many attempts from this address.',
  ) {
    super(`${reason} Try again in ${retryAfterSeconds} seconds.`);
    this.name = 'RequestThrottledError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(
    readonly detail: RateLimitDetail,
    message = rateLimitMessage(detail),
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}
