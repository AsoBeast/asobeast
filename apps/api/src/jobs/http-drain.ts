import type { Server } from 'http';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Injectable()
export class HttpDrain implements OnApplicationShutdown {
  private readonly logger = new Logger(HttpDrain.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  cutAfter(delayMs: number): void {
    const server = this.adapterHost.httpAdapter?.getHttpServer() as
      Server | undefined;
    if (!server || this.timer) return;
    this.timer = setTimeout(() => {
      this.logger.warn(
        `cut the http connections still open ${delayMs} ms after redis was found unreachable`,
      );
      server.closeAllConnections();
    }, delayMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearTimeout(this.timer);
  }
}
