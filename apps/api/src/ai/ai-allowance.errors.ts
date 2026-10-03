import type { AiAllowanceDetail } from '@asobeast/shared';

export const AI_ALLOWANCE_SPENT_RESPONSE = {
  description:
    'The monthly AI allowance is spent; aiAllowance says when it renews',
};

export class AiAllowanceExceededError extends Error {
  constructor(
    readonly detail: AiAllowanceDetail,
    readonly retryAfterSeconds: number,
  ) {
    super(
      `The monthly AI allowance is spent: ${detail.used} of ${detail.limit} calls used. It renews at ${detail.resetsAt}.`,
    );
    this.name = 'AiAllowanceExceededError';
  }
}
