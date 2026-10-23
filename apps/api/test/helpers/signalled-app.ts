import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { enableGracefulShutdown } from '../../src/graceful-shutdown';

@Module({})
class SignalledModule {}

async function start(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SignalledModule, {
    logger: false,
  });
  enableGracefulShutdown(app);
  process.on('SIGTERM', () => undefined);
  setInterval(() => undefined, 1_000);
  process.send?.('ready');
}

void start();
