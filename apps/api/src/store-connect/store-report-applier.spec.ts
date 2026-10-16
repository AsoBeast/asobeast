import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Logger } from '@nestjs/common';
import type { WorkspaceContext } from '../common/tenancy/workspace-context';
import type { PrismaService } from '../prisma/prisma.service';
import type { AscAnalyticsApi, AscSegment } from './asc-analytics-api';
import { StoreReportApplier } from './store-report-applier';

const HEADER =
  'Date\tApp Apple Identifier\tEvent\tPage Type\tSource Type\tEngagement Type\tTerritory\tCounts\tUnique Counts\n';
const first = gzipSync(
  Buffer.from(
    `${HEADER}2026-09-10\t1\tImpression\tNo page\tApp Store search\t\tUnited States\t10\t8\n`,
  ),
);
const second = gzipSync(
  Buffer.from(
    '2026-09-10\t1\tImpression\tNo page\tApp Store search\t\tAtlantis\t4\t4\n',
  ),
);

const segment = (id: string, bytes: Buffer, checksum: string): AscSegment => ({
  id,
  checksum,
  sizeInBytes: bytes.length,
  url: `https://example.test/${id}`,
});

const md5 = (bytes: Buffer) => createHash('md5').update(bytes).digest('hex');

function build(checksums: [string, string]) {
  const segments = [
    segment('a', first, checksums[0]),
    segment('b', second, checksums[1]),
  ];
  const api = {
    segments: jest.fn().mockResolvedValue(segments),
    download: jest.fn((each: AscSegment) =>
      Promise.resolve(each.id === 'a' ? first : second),
    ),
  };
  const tx = {
    storeReportInstance: {
      upsert: jest.fn().mockResolvedValue({ id: 'instance_1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    storeReportRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: jest.fn().mockResolvedValue(2),
  };
  const prisma = {
    withTransaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };
  const applier = new StoreReportApplier(
    prisma as unknown as PrismaService,
    { require: () => 'ws_1' } as unknown as WorkspaceContext,
  );
  const pending = {
    requestId: 'req_1',
    appId: 'app_1',
    instance: {
      id: 'i1',
      granularity: 'DAILY' as const,
      processingDate: '2026-09-12',
    },
  };
  return { applier, api, tx, pending };
}

describe('StoreReportApplier', () => {
  it('stores the raw gzip of every segment concatenated and the segment count', async () => {
    const { applier, api, tx, pending } = build([md5(first), md5(second)]);

    const applied = await applier.apply(
      api as unknown as AscAnalyticsApi,
      pending,
    );

    expect(applied).toEqual({ rows: 2, unresolved: ['Atlantis'] });
    const [{ create }] = tx.storeReportInstance.upsert.mock.calls[0] as [
      { create: { raw: Buffer; segments: number; workspaceId: string } },
    ];
    expect(create.raw).toEqual(Buffer.concat([first, second]));
    expect(create.segments).toBe(2);
    expect(create.workspaceId).toBe('ws_1');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('advances the last processing date and marks the instance applied inside the transaction', async () => {
    const { applier, api, tx, pending } = build([md5(first), md5(second)]);

    await applier.apply(api as unknown as AscAnalyticsApi, pending);

    const processingDate = new Date('2026-09-12T00:00:00.000Z');
    expect(tx.storeReportRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'req_1',
        OR: [
          { lastProcessingDate: null },
          { lastProcessingDate: { lt: processingDate } },
        ],
      },
      data: { lastProcessingDate: processingDate },
    });
    expect(tx.storeReportInstance.update).toHaveBeenCalledWith({
      where: { id: 'instance_1' },
      data: { appliedAt: expect.any(Date) as Date },
    });
  });

  it('logs a checksum mismatch and still applies the instance', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { applier, api, tx, pending } = build(['0'.repeat(32), md5(second)]);

    await applier.apply(api as unknown as AscAnalyticsApi, pending);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('checksum'));
    expect(tx.storeReportRequest.updateMany).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves the processing date alone when the transaction fails', async () => {
    const { applier, api, tx, pending } = build([md5(first), md5(second)]);
    tx.$executeRaw.mockRejectedValue(new Error('deadlock'));

    await expect(
      applier.apply(api as unknown as AscAnalyticsApi, pending),
    ).rejects.toThrow('deadlock');
    expect(tx.storeReportRequest.updateMany).not.toHaveBeenCalled();
  });
});
