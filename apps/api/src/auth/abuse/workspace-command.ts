import type { WorkspaceSuspension } from './workspace-suspension.service';

export const WORKSPACE_COMMAND_USAGE =
  'usage: node dist/auth/abuse/workspace-suspension.cli.js suspend <workspaceId> "<reason>" | restore <workspaceId>';

export type WorkspaceCommand =
  | { kind: 'suspend'; workspaceId: string; reason: string }
  | { kind: 'restore'; workspaceId: string };

export function parseWorkspaceCommand(
  argv: readonly string[],
): WorkspaceCommand | null {
  const [kind, workspaceId, reason] = argv;
  if (!workspaceId) return null;
  if (kind === 'restore') return { kind, workspaceId };
  if (kind === 'suspend' && reason) return { kind, workspaceId, reason };
  return null;
}

export async function runWorkspaceCommand(
  command: WorkspaceCommand,
  suspension: Pick<WorkspaceSuspension, 'suspend' | 'restore'>,
): Promise<string> {
  if (command.kind === 'suspend') {
    await suspension.suspend(command.workspaceId, command.reason);
    return `suspended ${command.workspaceId}`;
  }
  await suspension.restore(command.workspaceId);
  return `restored ${command.workspaceId}`;
}
