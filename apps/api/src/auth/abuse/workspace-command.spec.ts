import { ConflictException } from '@nestjs/common';
import {
  parseWorkspaceCommand,
  runWorkspaceCommand,
} from './workspace-command';
import {
  OPERATOR_WORKSPACE_NOT_SUSPENDABLE,
  type WorkspaceSuspension,
} from './workspace-suspension.service';

describe('parseWorkspaceCommand', () => {
  it('reads a suspension with its reason', () => {
    expect(parseWorkspaceCommand(['suspend', 'ws_a', 'abuse'])).toEqual({
      kind: 'suspend',
      workspaceId: 'ws_a',
      reason: 'abuse',
    });
  });

  it('reads a restore', () => {
    expect(parseWorkspaceCommand(['restore', 'ws_a'])).toEqual({
      kind: 'restore',
      workspaceId: 'ws_a',
    });
  });

  it.each([
    [[]],
    [['restore']],
    [['suspend', 'ws_a']],
    [['suspend', 'ws_a', '']],
    [['delete', 'ws_a']],
    [['suspend', 'ws_a', 'sustained', 'abuse']],
    [['restore', 'ws_a', 'extra']],
  ])('refuses %j', (argv) => {
    expect(parseWorkspaceCommand(argv)).toBeNull();
  });
});

describe('runWorkspaceCommand', () => {
  const suspension = () => ({
    suspend: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue(undefined),
  });

  it('suspends and says so', async () => {
    const fake = suspension();

    await expect(
      runWorkspaceCommand(
        { kind: 'suspend', workspaceId: 'ws_a', reason: 'abuse' },
        fake,
      ),
    ).resolves.toBe('suspended ws_a');
    expect(fake.suspend).toHaveBeenCalledWith('ws_a', 'abuse');
  });

  it('restores and says so', async () => {
    const fake = suspension();

    await expect(
      runWorkspaceCommand({ kind: 'restore', workspaceId: 'ws_a' }, fake),
    ).resolves.toBe('restored ws_a');
    expect(fake.restore).toHaveBeenCalledWith('ws_a');
  });

  it('lets the refusal to suspend the operator workspace through', async () => {
    const fake: Pick<WorkspaceSuspension, 'suspend' | 'restore'> = {
      suspend: jest
        .fn()
        .mockRejectedValue(
          new ConflictException(OPERATOR_WORKSPACE_NOT_SUSPENDABLE),
        ),
      restore: jest.fn(),
    };

    await expect(
      runWorkspaceCommand(
        { kind: 'suspend', workspaceId: 'ws_default', reason: 'self' },
        fake,
      ),
    ).rejects.toThrow(OPERATOR_WORKSPACE_NOT_SUSPENDABLE);
  });
});
