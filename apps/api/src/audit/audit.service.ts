import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppAuditResult, AuditHistory } from '@asobeast/shared';
import {
  WorkspaceFanOut,
  workspaceFailure,
} from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { DAY_MS } from './audit-scoring';
import { AuditHistoryQueryDto } from './dto/audit-history-query.dto';
import {
  CREATIVE_PROMPT_VERSION,
  creativeFingerprint,
} from './creative/creative-observations';
import { AUDIT_RUBRIC_VERSION, computeAudit } from './rubric';

const DEFAULT_HISTORY_DAYS = 90;
const MAX_HISTORY_DAYS = 365;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  private readonly inFlightAi = new Map<string, Promise<AppAuditResult>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: AuditContextLoader,
    private readonly auditAi: AuditAiService,
    private readonly fanOut: WorkspaceFanOut,
  ) {}

  async audit(appId: string): Promise<AppAuditResult> {
    return computeAudit(await this.loader.load(appId));
  }

  async runAi(appId: string): Promise<AppAuditResult> {
    const existing = this.inFlightAi.get(appId);
    if (existing) {
      return existing;
    }
    const run = this.generateAi(appId).finally(() =>
      this.inFlightAi.delete(appId),
    );
    this.inFlightAi.set(appId, run);
    return run;
  }

  private async generateAi(appId: string): Promise<AppAuditResult> {
    const inputs = await this.loader.creativeInputs(appId);
    const observations = await this.auditAi.observe(inputs);
    const model = this.auditAi.model ?? 'unknown';
    const stored = {
      model,
      observations,
      inputHash: creativeFingerprint(inputs, model),
      promptVersion: CREATIVE_PROMPT_VERSION,
      generatedAt: new Date(),
      runState: 'completed',
      runError: null,
    };
    await this.prisma.auditInsight.upsert({
      where: { appId },
      create: { appId, ...stored },
      update: stored,
    });
    await this.recordToday(appId);
    return this.audit(appId);
  }

  async recordToday(appId: string): Promise<void> {
    const result = await this.audit(appId);
    const date = utcDate();
    await this.prisma.auditScore.upsert({
      where: { appId_date: { appId, date } },
      create: { appId, date, ...toScoreRow(result) },
      update: toScoreRow(result),
    });
  }

  async snapshotAll(): Promise<number> {
    const { results, failures } = await this.fanOut.each(
      'the nightly audit snapshot covers every workspace',
      () => this.snapshotWorkspace(),
    );
    const total = results.reduce(
      (sum: number, saved: number) => sum + saved,
      0,
    );
    const failure = workspaceFailure(failures, 'failed to snapshot its audit');
    if (failure) throw failure;
    return total;
  }

  private async snapshotWorkspace(): Promise<number> {
    const apps = await this.prisma.app.findMany({
      where: { isCompetitor: false },
      select: { id: true },
    });

    let saved = 0;
    for (const { id } of apps) {
      try {
        await this.recordToday(id);
        saved += 1;
      } catch (error) {
        this.logger.error(`audit snapshot failed for app ${id}`, error);
      }
    }

    this.logger.log(`audit snapshot saved ${saved}/${apps.length}`);
    return saved;
  }

  async history(
    appId: string,
    query: AuditHistoryQueryDto,
  ): Promise<AuditHistory> {
    await this.loader.app(appId);

    const to = query.to ? utcDate(new Date(query.to)) : utcDate();
    const earliest = new Date(to.getTime() - MAX_HISTORY_DAYS * DAY_MS);
    const requestedFrom = query.from
      ? utcDate(new Date(query.from))
      : new Date(to.getTime() - DEFAULT_HISTORY_DAYS * DAY_MS);
    const from = requestedFrom < earliest ? earliest : requestedFrom;

    const rows = await this.prisma.auditScore.findMany({
      where: { appId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        overall: true,
        coveredWeight: true,
        totalWeight: true,
        rubricVersion: true,
        confidence: true,
      },
    });

    return {
      points: rows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        overall: row.overall,
        coveredWeight: row.coveredWeight,
        totalWeight: row.totalWeight,
        rubricVersion: row.rubricVersion,
        confidence: row.confidence,
      })),
    };
  }
}

const utcDate = (now = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

const toSlimFactors = (result: AppAuditResult): Prisma.InputJsonValue =>
  result.factors.map((factor) => ({
    id: factor.id,
    score: factor.score,
    weight: factor.weight,
  }));

const toScoreRow = (result: AppAuditResult) => ({
  overall: result.overall,
  coveredWeight: result.coveredWeight,
  totalWeight: result.totalWeight,
  factors: toSlimFactors(result),
  rubricVersion: AUDIT_RUBRIC_VERSION,
  confidence: result.confidence ?? null,
});
