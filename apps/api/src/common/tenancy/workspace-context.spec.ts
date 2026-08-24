import {
  WorkspaceContext,
  WorkspaceContextMissingError,
} from './workspace-context';

describe('WorkspaceContext', () => {
  let context: WorkspaceContext;

  beforeEach(() => {
    context = new WorkspaceContext();
  });

  it('exposes nothing outside a scope', () => {
    expect(context.current).toBeUndefined();
    expect(() => context.require('a read')).toThrow(
      WorkspaceContextMissingError,
    );
  });

  it('names the operation in the missing-context error', () => {
    expect(() => context.require('a read')).toThrow(
      'No workspace in scope for a read',
    );
  });

  it('resolves the workspace inside a scope', async () => {
    const seen = await context.run('ws_a', () =>
      Promise.resolve(context.require('a read')),
    );
    expect(seen).toBe('ws_a');
  });

  it('binds a workspace into an open scope', () => {
    let seen: string | undefined;
    context.openScope(() => {
      context.bind('ws_a');
      seen = context.current;
    });
    expect(seen).toBe('ws_a');
  });

  it('refuses to bind without an open scope', () => {
    expect(() => context.bind('ws_a')).toThrow(WorkspaceContextMissingError);
  });

  it('keeps the workspace across awaits', async () => {
    const seen = await context.run('ws_a', async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 1));
      return context.require('a read');
    });
    expect(seen).toBe('ws_a');
  });

  it('holds the scope open while work it did not await settles', async () => {
    const deferred = await context.run('ws_a', () =>
      Promise.resolve().then(() => context.current),
    );
    expect(deferred).toBe('ws_a');
  });

  it('isolates concurrent scopes', async () => {
    const read = (workspaceId: string, delay: number) =>
      context.run(workspaceId, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return context.require('a read');
      });

    const [a, b] = await Promise.all([read('ws_a', 5), read('ws_b', 1)]);

    expect(a).toBe('ws_a');
    expect(b).toBe('ws_b');
  });

  it('does not leak a nested scope to its parent', async () => {
    const seen = await context.run('ws_a', async () => {
      await context.run('ws_b', () => Promise.resolve(context.current));
      return context.current;
    });
    expect(seen).toBe('ws_a');
  });

  it('separates cross-tenant scope from a workspace scope', async () => {
    const crossing = await context.runCrossTenant(() =>
      Promise.resolve({
        crossTenant: context.crossTenant,
        workspaceId: context.current,
      }),
    );

    expect(crossing).toEqual({ crossTenant: true, workspaceId: undefined });
    expect(context.crossTenant).toBe(false);
  });
});
