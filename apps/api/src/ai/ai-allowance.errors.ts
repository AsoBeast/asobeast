import { NO_AI_CALLS_MESSAGE, type AiAllowanceDetail } from '@asobeast/shared';

export const AI_ALLOWANCE_SPENT_RESPONSE = {
  description:
    'The monthly AI allowance is spent; aiAllowance says when it renews',
};

function messageFor({ limit, used, resetsAt }: AiAllowanceDetail): string {
  if (limit === 0) return `${NO_AI_CALLS_MESSAGE}.`;
  return `The monthly AI allowance is spent: ${used} of ${limit} calls used. It renews at ${resetsAt}.`;
}

export class AiAllowanceExceededError extends Error {
  constructor(
    readonly detail: AiAllowanceDetail,
    readonly retryAfterSeconds: number,
  ) {
    super(messageFor(detail));
    this.name = 'AiAllowanceExceededError';
  }
}
