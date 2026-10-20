import type { HealthStatus } from '@asobeast/shared';

export const DATABASE_RETRY_AFTER_SECONDS = 5;

export class DatabaseUnavailableError extends Error {
  readonly retryAfterSeconds = DATABASE_RETRY_AFTER_SECONDS;

  constructor(readonly health: HealthStatus) {
    super(
      `The database cannot be reached. Try again in ${DATABASE_RETRY_AFTER_SECONDS} seconds.`,
    );
    this.name = 'DatabaseUnavailableError';
  }
}
