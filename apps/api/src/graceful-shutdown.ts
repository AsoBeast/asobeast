import {
  Injectable,
  Logger,
  type INestApplication,
  type OnApplicationShutdown,
} from '@nestjs/common';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'];

@Injectable()
export class ShutdownReporter implements OnApplicationShutdown {
  private readonly logger = new Logger('GracefulShutdown');

  onApplicationShutdown(signal?: string): void {
    if (!signal) return;
    this.logger.log(`stopped on ${signal}`);
  }
}

export function enableGracefulShutdown(app: INestApplication): void {
  app.enableShutdownHooks(SHUTDOWN_SIGNALS);
}
