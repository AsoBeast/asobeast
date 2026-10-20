import { once } from 'node:events';
import { Writable } from 'node:stream';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountExportService } from './account-export.service';
import { ExportSinkClosedError } from './export-sink';
import { EXPORT_PAGE_SIZE } from './export-tables';

const WORKSPACE = 'ws_export';

function prismaWith(rows: Record<string, unknown[]>): PrismaService {
  const model = (name: string) => ({
    count: () => Promise.resolve((rows[name] ?? []).length),
    findMany: ({ skip, take }: { skip: number; take: number }) =>
      Promise.resolve((rows[name] ?? []).slice(skip, skip + take)),
    groupBy: () => Promise.resolve([]),
  });
  return new Proxy({} as PrismaService, {
    get: (_target, property: string) => model(property),
  });
}

function collector(highWaterMark?: number) {
  const chunks: string[] = [];
  const sink = new Writable({
    highWaterMark,
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      setImmediate(callback);
    },
  });
  const lines = async () => {
    sink.end();
    await once(sink, 'finish');
    return chunks
      .join('')
      .split('\n')
      .filter((line) => line.length > 0);
  };
  return { lines, sink };
}

function exporterFor(rows: Record<string, unknown[]>) {
  const workspace = new WorkspaceContext();
  return {
    workspace,
    service: new AccountExportService(prismaWith(rows), workspace),
  };
}

function swallowDrain(sink: Writable): void {
  const emit = sink.emit.bind(sink);
  sink.emit = ((event: string | symbol, ...args: unknown[]) =>
    event === 'drain' ? false : emit(event, ...args)) as Writable['emit'];
}

function within<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`did not finish within ${milliseconds} ms`)),
      milliseconds,
    );
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

describe('AccountExportService', () => {
  it('opens with a manifest that counts every table', async () => {
    const { service, workspace } = exporterFor({
      app: [{ id: 'app1', name: 'Focus' }],
    });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const manifest = JSON.parse((await lines())[0]) as {
      manifest: {
        workspaceId: string;
        tables: { table: string; rows: number }[];
      };
    };
    expect(manifest.manifest.workspaceId).toBe(WORKSPACE);
    expect(manifest.manifest.tables).toContainEqual({ table: 'app', rows: 1 });
  });

  it('writes one line per row, without its secrets', async () => {
    const { service, workspace } = exporterFor({
      user: [{ id: 'u1', email: 'owner@example.com', passwordHash: 'argon2' }],
    });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const written = await lines();
    const user = written
      .slice(1)
      .map((line) => JSON.parse(line) as { table: string; row: unknown })
      .find((line) => line.table === 'user');
    expect(user?.row).toEqual({ id: 'u1', email: 'owner@example.com' });
    expect(written.join('')).not.toContain('argon2');
  });

  it('writes no recovery, session or checkout state of any row', async () => {
    const { service, workspace } = exporterFor({
      user: [
        {
          id: 'u1',
          email: 'owner@example.com',
          resetHash: 'reset-hash-sentinel',
          resetExpiresAt: 'reset-expiry-sentinel',
          sessionVersion: 41,
        },
      ],
      workspace: [
        {
          id: WORKSPACE,
          plan: 'indie',
          checkoutClaimToken: 'claim-sentinel',
          checkoutSessionId: 'cs_sentinel',
        },
      ],
    });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const written = (await lines()).join('\n');
    expect(written).toContain('owner@example.com');
    expect(written).toContain('"plan":"indie"');
    for (const sentinel of [
      'reset-hash-sentinel',
      'reset-expiry-sentinel',
      'claim-sentinel',
      'cs_sentinel',
      'sessionVersion',
    ]) {
      expect(written).not.toContain(sentinel);
    }
  });

  it('pages past the first batch rather than stopping at it', async () => {
    const rows = Array.from({ length: EXPORT_PAGE_SIZE + 7 }, (_, index) => ({
      id: `kw${index}`,
    }));
    const { service, workspace } = exporterFor({ keywordRanking: rows });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const exported = (await lines())
      .slice(1)
      .map((line) => JSON.parse(line) as { table: string })
      .filter((line) => line.table === 'keywordRanking');
    expect(exported).toHaveLength(rows.length);
  });

  it('waits for a slow reader instead of buffering the whole export', async () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({
      id: `r${index}`,
      blob: 'x'.repeat(200),
    }));
    const { service, workspace } = exporterFor({ review: rows });
    const { lines, sink } = collector(64);

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const written = (await lines())
      .slice(1)
      .map((line) => JSON.parse(line) as { table: string });
    expect(written.filter((line) => line.table === 'review')).toHaveLength(
      rows.length,
    );
  });

  it('finishes when the sink never emits drain', async () => {
    const rows = Array.from({ length: 300 }, (_, index) => ({
      id: `r${index}`,
      blob: 'x'.repeat(400),
    }));
    const { service, workspace } = exporterFor({ review: rows });
    const { lines, sink } = collector(1);
    swallowDrain(sink);

    await within(
      workspace.run(WORKSPACE, () => service.stream(sink)),
      2_000,
    );

    const written = (await lines())
      .slice(1)
      .map((line) => JSON.parse(line) as { table: string });
    expect(written.filter((line) => line.table === 'review')).toHaveLength(
      rows.length,
    );
  });

  it('ends with a closed sink error when the client goes away mid stream', async () => {
    const rows = Array.from({ length: EXPORT_PAGE_SIZE * 2 }, (_, index) => ({
      id: `r${index}`,
      blob: 'x'.repeat(200),
    }));
    const { service, workspace } = exporterFor({ review: rows });
    let writes = 0;
    const sink = new Writable({
      write(_chunk, _encoding, callback) {
        writes += 1;
        if (writes === 2) this.destroy();
        else setImmediate(callback);
      },
    });

    await expect(
      within(
        workspace.run(WORKSPACE, () => service.stream(sink)),
        2_000,
      ),
    ).rejects.toBeInstanceOf(ExportSinkClosedError);
    expect(writes).toBe(2);
  });

  it('refuses to export with no workspace in scope', async () => {
    const { service } = exporterFor({});
    const { sink } = collector();

    await expect(service.stream(sink)).rejects.toThrow('No workspace in scope');
  });
});
