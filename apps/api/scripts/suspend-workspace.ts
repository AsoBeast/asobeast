import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WorkspaceSuspension } from '../src/auth/abuse/workspace-suspension.service';

const USAGE =
  'usage: pnpm --filter api workspace:suspend <workspaceId> "<reason>" | pnpm --filter api workspace:restore <workspaceId>';

async function main(): Promise<void> {
  const [command, workspaceId, reason] = process.argv.slice(2);
  if (!workspaceId || (command === 'suspend' && !reason)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const suspension = app.get(WorkspaceSuspension);
  try {
    if (command === 'suspend') await suspension.suspend(workspaceId, reason);
    else if (command === 'restore') await suspension.restore(workspaceId);
    else {
      console.error(USAGE);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
