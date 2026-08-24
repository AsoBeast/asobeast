import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { OverLimitRegistry, OverLimitState } from './over-limit.registry';

const WORKSPACE = 'ws_over';
const NOW = new Date('2026-08-08T03:00:00Z');

describe('OverLimitRegistry', () => {
  const findFirst = jest.fn<Promise<OverLimitRow | null>, []>();
  const update = jest.fn<Promise<void>, [{ data: Record<string, unknown> }]>();

  interface OverLimitRow {
    overLimitSince: Date | null;
    overLimitNotifiedAt: Date | null;
  }

  const prisma = {
    workspace: { findFirst, update },
  } as unknown as PrismaService;

  const workspace = new WorkspaceContext();
  const registry = new OverLimitRegistry(prisma, workspace);
  const scoped = <T>(work: () => Promise<T>) => workspace.run(WORKSPACE, work);

  const lastData = () => update.mock.calls.at(-1)?.[0].data ?? {};

  const state = (over: Partial<OverLimitState> = {}): OverLimitState => ({
    since: null,
    notifiedAt: null,
    ...over,
  });

  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue(null);
    update.mockReset().mockResolvedValue(undefined);
  });

  it('reports no history for a workspace that has never been over', async () => {
    await expect(scoped(() => registry.state())).resolves.toEqual({
      since: null,
      notifiedAt: null,
    });
  });

  it('stamps the first day a workspace goes over', async () => {
    await scoped(() => registry.recordOverLimit(state(), detail(), NOW));

    expect(lastData()).toEqual({
      overLimitSince: NOW,
      overLimitNotifiedAt: NOW,
    });
  });

  it('keeps the original notification date on later days', async () => {
    const earlier = new Date('2026-08-01T03:00:00Z');

    await scoped(() =>
      registry.recordOverLimit(
        state({ since: earlier, notifiedAt: earlier }),
        detail(),
        NOW,
      ),
    );

    expect(lastData()).toEqual({
      overLimitSince: earlier,
      overLimitNotifiedAt: earlier,
    });
  });

  it('clears the flag once the workspace fits again', async () => {
    await scoped(() =>
      registry.recordWithinLimit(state({ since: NOW, notifiedAt: NOW })),
    );

    expect(lastData()).toEqual({
      overLimitSince: null,
      overLimitNotifiedAt: null,
    });
  });

  it('writes nothing for a workspace that was already inside its limit', async () => {
    await scoped(() => registry.recordWithinLimit(state()));

    expect(update).not.toHaveBeenCalled();
  });

  function detail() {
    return { used: 1200, limit: 1000, dropped: 200 };
  }
});
