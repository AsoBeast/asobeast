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
  INSPECTION_DETAIL_SELECT,
  INSPECTION_SUMMARY_SELECT,
  InspectionDetailRow,
  toInspection,
  toInspectionSummary,
} from './inspection-view';

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
    spend: () => Promise<void>,
  ): Promise<KeywordInspection> {
    assertStorefront(request.store, request.country);
    const text = normalizeKeyword(request.keyword);
    const workspaceId = this.workspace.require('a keyword inspection');
    const keywordId = await this.keywordIdOf(
      text,
      request.store,
      request.country,
    );
    const pending = await this.prisma.keywordInspection.findFirst({
      where: { workspaceId, keywordId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      return this.get(pending.id);
    }
    await spend();
    const created = await this.prisma.keywordInspection.create({
      data: { workspaceId, keywordId },
      select: { id: true },
    });
    await this.queueFor(request.store).add(
      JOBS.INSPECT_KEYWORD,
      {
        inspectionId: created.id,
        ...this.workspace.scopeFor('a keyword inspection'),
      },
      { jobId: inspectKeywordJobId(created.id) },
    );
    return this.get(created.id);
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
    return toInspection(row, await this.previousOf(row));
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

  private queueFor(store: Store): Queue {
    return store === 'GOOGLE_PLAY' ? this.gplayQueue : this.appStoreQueue;
  }
}
