import { once } from 'node:events';
import { Writable } from 'node:stream';
import type { Prisma } from '@prisma/client';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountExportService } from './account-export.service';
import { ExportSinkClosedError } from './export-sink';
import { EXPORT_PAGE_SIZE } from './export-tables';

const WORKSPACE = 'ws_export';

type Row = Record<string, unknown>;

interface Page {
  where?: Row;
  orderBy?: Row | Row[];
}

const compare = (left: unknown, right: unknown): number =>
  String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'OR')
      return (condition as Row[]).some((term) => matches(row, term));
    if (field === 'AND')
      return (condition as Row[]).every((term) => matches(row, term));
    if (condition !== null && typeof condition === 'object') {
      const { gt, gte, lt, lte } = condition as Record<string, unknown>;
      if (gt !== undefined && compare(row[field], gt) <= 0) return false;
      if (gte !== undefined && compare(row[field], gte) < 0) return false;
      if (lt !== undefined && compare(row[field], lt) >= 0) return false;
      if (lte !== undefined && compare(row[field], lte) > 0) return false;
      return true;
    }
    return compare(row[field], condition) === 0;
  });
}

function byKey(key: string[]) {
  return (left: Row, right: Row): number => {
    for (const field of key) {
      const order = compare(left[field], right[field]);
      if (order !== 0) return order;
    }
    return 0;
  };
}

function keysOf(rows: Record<string, Row[]>, query: Prisma.Sql): Row[] {
  const [, columns, table] = /^SELECT (\S+) FROM "(\w+)"/.exec(query.sql) ?? [];
  const key = columns.replaceAll('"', '').split(',');
  const take = query.values[query.values.length - 1] as number;
  const after = query.values.slice(0, -1);
  const name = table.charAt(0).toLowerCase() + table.slice(1);
  const position = Object.fromEntries(
    key.map((field, index) => [field, after[index]]),
  );
  const order = byKey(key);
  return [...(rows[name] ?? [])]
    .sort(order)
    .filter((row) => after.length === 0 || order(row, position) > 0)
    .slice(0, take)
    .map((row) => Object.fromEntries(key.map((field) => [field, row[field]])));
}

function sorted(rows: Row[], orderBy: Page['orderBy']): Row[] {
  const fields = [orderBy ?? []].flat().flatMap((entry) => Object.keys(entry));
  return [...rows].sort(byKey(fields));
}

function prismaWith(
  rows: Record<string, Row[]>,
  afterRead: (model: string, reads: number) => void = () => undefined,
): PrismaService {
  const reads = new Map<string, number>();
  const model = (name: string) => ({
    count: () => Promise.resolve((rows[name] ?? []).length),
    findMany: ({ where, orderBy }: Page) => {
      const page = sorted(rows[name] ?? [], orderBy).filter((row) =>
        matches(row, where),
      );
      const read = (reads.get(name) ?? 0) + 1;
      reads.set(name, read);
      afterRead(name, read);
      return Promise.resolve(page);
    },
    groupBy: () => Promise.resolve([]),
  });
  return new Proxy({} as PrismaService, {
    get: (_target, property: string) =>
      property === '$queryRaw'
        ? (query: Prisma.Sql) => Promise.resolve(keysOf(rows, query))
        : model(property),
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

function exporterFor(
  rows: Record<string, Row[]>,
  afterRead?: (model: string, reads: number) => void,
) {
  const workspace = new WorkspaceContext();
  return {
    workspace,
    service: new AccountExportService(prismaWith(rows, afterRead), workspace),
  };
}

const ranking = (index: number): Row => ({
  appId: 'app1',
  keywordId: `kw${String(index).padStart(5, '0')}`,
  date: '2023-01-01',
});

const exportedRows = (lines: string[], table: string): Row[] =>
  lines
    .slice(1)
    .map((line) => JSON.parse(line) as { table: string; row: Row })
    .filter((line) => line.table === table)
    .map((line) => line.row);

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
    const rows = Array.from({ length: EXPORT_PAGE_SIZE + 7 }, (_, index) =>
      ranking(index),
    );
    const { service, workspace } = exporterFor({ keywordRanking: rows });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    expect(exportedRows(await lines(), 'keywordRanking')).toHaveLength(
      rows.length,
    );
  });

  it('writes every row that still exists when rows before the read position are deleted between pages', async () => {
    const rows = Array.from(
      { length: EXPORT_PAGE_SIZE * 2 + 500 },
      (_, index) => ranking(index),
    );
    const table = { keywordRanking: [...rows] };
    const { service, workspace } = exporterFor(table, (model, reads) => {
      if (model === 'keywordRanking' && reads === 1) {
        table.keywordRanking.splice(0, 1_000);
      }
    });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const written = new Set(
      exportedRows(await lines(), 'keywordRanking').map((row) => row.keywordId),
    );
    const missing = rows
      .slice(1_000)
      .filter((row) => !written.has(row.keywordId));
    expect(missing).toEqual([]);
  });

  it('writes no row twice when rows that sort first are inserted between pages', async () => {
    const rows = Array.from({ length: EXPORT_PAGE_SIZE * 2 }, (_, index) =>
      ranking(index + 1_000),
    );
    const table = { keywordRanking: [...rows] };
    const { service, workspace } = exporterFor(table, (model, reads) => {
      if (model === 'keywordRanking' && reads === 1) {
        table.keywordRanking.push(
          ...Array.from({ length: 500 }, (_, index) => ranking(index)),
        );
      }
    });
    const { lines, sink } = collector();

    await workspace.run(WORKSPACE, () => service.stream(sink));

    const keys = exportedRows(await lines(), 'keywordRanking').map(
      (row) => row.keywordId,
    );
    expect(keys).toHaveLength(new Set(keys).size);
    for (const row of rows) expect(keys).toContain(row.keywordId);
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
