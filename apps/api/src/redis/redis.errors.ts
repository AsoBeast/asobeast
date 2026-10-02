export class RedisUnavailableError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `This action is temporarily unavailable because Redis cannot be reached. Try again in ${retryAfterSeconds} seconds.`,
    );
    this.name = 'RedisUnavailableError';
  }
}
