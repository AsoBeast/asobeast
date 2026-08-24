import { once } from 'node:events';
import { Writable } from 'node:stream';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountExportService } from './account-export.service';
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

  it('refuses to export with no workspace in scope', async () => {
    const { service } = exporterFor({});
    const { sink } = collector();

    await expect(service.stream(sink)).rejects.toThrow('No workspace in scope');
  });
});
