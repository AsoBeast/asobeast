import { Injectable, Logger } from '@nestjs/common';
import type { Writable } from 'node:stream';
import type { WorkspaceExportManifest } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  EXPORT_PAGE_SIZE,
  exportTables,
  withoutSecrets,
  type ExportTable,
} from './export-tables';
import { writeBatched } from './export-sink';

@Injectable()
export class AccountExportService {
  private readonly logger = new Logger(AccountExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
  ) {}

  async stream(sink: Writable, now = new Date()): Promise<void> {
    const workspaceId = this.workspace.require('a workspace export');
    const tables = exportTables(this.prisma);
    const manifest = await this.manifest(workspaceId, tables, now);

    await writeBatched(sink, this.lines(manifest, tables));
    this.logger.log(
      `exported ${workspaceId} ${JSON.stringify(
        manifest.tables.filter((entry) => entry.rows > 0),
      )}`,
    );
  }

  private async manifest(
    workspaceId: string,
    tables: ExportTable[],
    now: Date,
  ): Promise<WorkspaceExportManifest> {
    const counts = await Promise.all(tables.map((table) => table.count()));
    return {
      workspaceId,
      exportedAt: now.toISOString(),
      format: 'ndjson',
      tables: tables.map((table, index) => ({
        table: table.name,
        rows: counts[index],
      })),
    };
  }

  private async *lines(
    manifest: WorkspaceExportManifest,
    tables: ExportTable[],
  ): AsyncGenerator<string> {
    yield ndjson({ manifest });
    for (const table of tables) {
      yield* this.tableLines(table);
    }
  }

  private async *tableLines(table: ExportTable): AsyncGenerator<string> {
    for (let skip = 0; ; skip += EXPORT_PAGE_SIZE) {
      const rows = await table.read(skip, EXPORT_PAGE_SIZE);
      for (const row of rows) {
        yield ndjson({ table: table.name, row: withoutSecrets(row) });
      }
      if (rows.length < EXPORT_PAGE_SIZE) return;
    }
  }
}

function ndjson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}
