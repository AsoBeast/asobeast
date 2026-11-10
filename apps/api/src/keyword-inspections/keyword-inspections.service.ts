import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertStorefront,
  KEYWORD_INSPECTION_LIST_LIMIT,
  KeywordInspection,
  KeywordInspectionList,
  KeywordInspectionRequest,
  Store,
} from '@asobeast/shared';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { inspectKeywordJobId, JOBS, QUEUES } from '../jobs/jobs.types';
import { normalizeKeyword } from '../keywords/keywords.support';
import { PrismaService } from '../prisma/prisma.service';
import {
  INSPECTION_DROPPED,
  INSPECTION_NOT_QUEUED,
  INSPECTION_PENDING_TTL_MS,
  INSPECTION_TIMED_OUT,
} from './inspection-failures';
import {
  INSPECTION_DETAIL_SELECT,
  INSPECTION_SUMMARY_SELECT,
  InspectionDetailRow,
  toInspection,
  toInspectionSummary,
} from './inspection-view';

const INSPECTION_LOCK = 6_431_907;

export interface InspectionAllowance {
  spend: () => Promise<void>;
  refund: () => Promise<void>;
}

export interface KeywordInspectionFilter {
  keyword?: string;
  store?: Store;
  country?: string;
  limit?: number;
}

@Injectable()
export class KeywordInspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    @InjectQueue(QUEUES.APP_STORE) private readonly appStoreQueue: Queue,
    @InjectQueue(QUEUES.GPLAY) private readonly gplayQueue: Queue,
  ) {}

  async request(
    request: KeywordInspectionRequest,
    allowance: InspectionAllowance,
  ): Promise<KeywordInspection> {
    assertStorefront(request.store, request.country);
    const text = normalizeKeyword(request.keyword);
    const workspaceId = this.workspace.require('a keyword inspection');
    const keywordId = await this.keywordIdOf(
      text,
      request.store,
      request.country,
    );
    await this.expireStale(keywordId, request.store);
    const waiting = await this.pendingOf(this.prisma, keywordId);
    if (waiting) {
      return this.get(waiting);
    }
    let spent = false;
    try {
      const claim = await this.prisma.withTransaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${INSPECTION_LOCK}::int, hashtext(${`${workspaceId}~${keywordId}`}))`;
        const pending = await this.pendingOf(tx, keywordId);
        if (pending) {
          return { id: pending, queued: false };
        }
        await allowance.spend();
        spent = true;
        const created = await tx.keywordInspection.create({
          data: { workspaceId, keywordId },
          select: { id: true },
        });
        return { id: created.id, queued: true };
      });
      if (claim.queued) {
        await this.enqueue(claim.id, request.store);
      }
      return await this.get(claim.id);
    } catch (error) {
      if (spent) {
        await allowance.refund();
      }
      throw error;
    }
  }

  async list(filter: KeywordInspectionFilter): Promise<KeywordInspectionList> {
    const rows = await this.prisma.keywordInspection.findMany({
      where: this.whereOf(filter),
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: filter.limit ?? KEYWORD_INSPECTION_LIST_LIMIT,
      select: INSPECTION_SUMMARY_SELECT,
    });
    return { items: rows.map(toInspectionSummary) };
  }

  async get(id: string): Promise<KeywordInspection> {
    const row = await this.prisma.keywordInspection.findFirst({
      where: { id },
      select: INSPECTION_DETAIL_SELECT,
    });
    if (!row) {
      throw new NotFoundException(`Keyword inspection ${id} not found`);
    }
    return toInspection(
      row,
      row.status === 'DONE' ? await this.previousOf(row) : null,
    );
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.keywordInspection.deleteMany({
      where: { id },
    });
    if (count === 0) {
      throw new NotFoundException(`Keyword inspection ${id} not found`);
    }
  }

  private previousOf(
    row: InspectionDetailRow,
  ): Promise<InspectionDetailRow | null> {
    return this.prisma.keywordInspection.findFirst({
      where: {
        keywordId: row.keywordId,
        status: 'DONE',
        id: { not: row.id },
        requestedAt: { lt: row.requestedAt },
      },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      select: INSPECTION_DETAIL_SELECT,
    });
  }

  private whereOf(
    filter: KeywordInspectionFilter,
  ): Prisma.KeywordInspectionWhereInput {
    const keyword: Prisma.KeywordWhereInput = {
      ...(filter.store === undefined ? {} : { store: filter.store }),
      ...(filter.country === undefined ? {} : { country: filter.country }),
      ...(filter.keyword === undefined
        ? {}
        : { text: normalizeKeyword(filter.keyword) }),
    };
    return Object.keys(keyword).length === 0 ? {} : { keyword };
  }

  private async keywordIdOf(
    text: string,
    store: Store,
    country: string,
  ): Promise<string> {
    await this.prisma.keyword.createMany({
      data: [{ text, store, country }],
      skipDuplicates: true,
    });
    const keyword = await this.prisma.keyword.findUniqueOrThrow({
      where: { text_store_country: { text, store, country } },
      select: { id: true },
    });
    return keyword.id;
  }

  private async expireStale(keywordId: string, store: Store): Promise<void> {
    const cutoff = new Date(Date.now() - INSPECTION_PENDING_TTL_MS);
    await this.prisma.keywordInspection.updateMany({
      where: { keywordId, status: 'PENDING', startedAt: { lt: cutoff } },
      data: {
        status: 'FAILED',
        failure: INSPECTION_TIMED_OUT,
        completedAt: new Date(),
      },
    });
    const waiting = await this.prisma.keywordInspection.findMany({
      where: {
        keywordId,
        status: 'PENDING',
        startedAt: null,
        requestedAt: { lt: cutoff },
      },
      select: { id: true },
    });
    for (const { id } of waiting) {
      if (await this.stillQueued(id, store)) continue;
      await this.prisma.keywordInspection.updateMany({
        where: { id, status: 'PENDING', startedAt: null },
        data: {
          status: 'FAILED',
          failure: INSPECTION_DROPPED,
          completedAt: new Date(),
        },
      });
    }
  }

  private async stillQueued(id: string, store: Store): Promise<boolean> {
    try {
      const job = await this.queueFor(store).getJob(inspectKeywordJobId(id));
      if (!job) return false;
      const state = await job.getState();
      return state !== 'completed' && state !== 'failed' && state !== 'unknown';
    } catch {
      return true;
    }
  }

  private async pendingOf(
    client: Prisma.TransactionClient | PrismaService,
    keywordId: string,
  ): Promise<string | null> {
    const pending = await client.keywordInspection.findFirst({
      where: { keywordId, status: 'PENDING' },
      select: { id: true },
    });
    return pending?.id ?? null;
  }

  private async enqueue(id: string, store: Store): Promise<void> {
    try {
      await this.queueFor(store).add(
        JOBS.INSPECT_KEYWORD,
        {
          inspectionId: id,
          ...this.workspace.scopeFor('a keyword inspection'),
        },
        { jobId: inspectKeywordJobId(id) },
      );
    } catch (error) {
      await this.prisma.keywordInspection.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'FAILED',
          failure: INSPECTION_NOT_QUEUED,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private queueFor(store: Store): Queue {
    return store === 'GOOGLE_PLAY' ? this.gplayQueue : this.appStoreQueue;
  }
}
