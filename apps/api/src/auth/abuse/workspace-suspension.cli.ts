import { NestFactory } from '@nestjs/core';
import {
  WORKSPACE_COMMAND_USAGE,
  parseWorkspaceCommand,
  runWorkspaceCommand,
} from './workspace-command';
import { WorkspaceSuspensionCliModule } from './workspace-suspension-cli.module';
import { WorkspaceSuspension } from './workspace-suspension.service';

async function main(): Promise<void> {
  const command = parseWorkspaceCommand(process.argv.slice(2));
  if (!command) {
    console.error(WORKSPACE_COMMAND_USAGE);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(
    WorkspaceSuspensionCliModule,
    { logger: ['warn', 'error'] },
  );
  try {
    console.log(
      await runWorkspaceCommand(command, app.get(WorkspaceSuspension)),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
