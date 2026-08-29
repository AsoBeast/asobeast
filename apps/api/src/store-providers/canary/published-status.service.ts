import { type Store } from '@asobeast/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { fetch, type Dispatcher, type Response } from 'undici';
import { publicOnlyDispatcher } from '../../alerts/webhook-dispatcher';
import { assertDeliverableUrl } from '../../alerts/webhook-target';
import { Env } from '../../config/env';
import { PUBLISHED_STATUS_KEY, QUEUES } from '../../jobs/jobs.types';
import {
  parsePublishedStatus,
  type PublishedStoreStatus,
} from './published-status';

export const PUBLISHED_STATUS_TIMEOUT_MS = 10_000;

export const PUBLISHED_STATUS_MAX_BYTES = 64 * 1024;

export const PUBLISHED_STATUS_MAX_AGE_HOURS = 48;

const HOUR_MS = 3_600_000;

export interface PublishedStatusRecord {
  fetchedAt: string;
  stores: Partial<Record<Store, PublishedStoreStatus>>;
}

interface PublishedKeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

@Injectable()
export class PublishedStatusService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishedStatusService.name);
  private readonly target: URL | null;
  private readonly dispatcher: Dispatcher;

  constructor(
    config: ConfigService<Env, true>,
    @InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue,
  ) {
    this.target = this.resolveTarget(
      config.get('STORE_STATUS_URL', { infer: true }),
    );
    this.cron = config.get('CRON_STORE_STATUS', { infer: true });
    this.dispatcher = publicOnlyDispatcher();
  }

  readonly cron: string;

  get enabled(): boolean {
    return this.target !== null;
  }

  onModuleDestroy(): Promise<void> {
    return this.dispatcher.close();
  }

  async run(): Promise<void> {
    if (!this.target) return;

    const document = await this.download(this.target);
    if (document === null) return;

    const stores = parsePublishedStatus(document);
    if (stores === null) {
      this.logger.warn(
        `${this.target.href} is not a store status document this version understands, so nothing changed`,
      );
      return;
    }

    const record: PublishedStatusRecord = {
      fetchedAt: new Date().toISOString(),
      stores,
    };
    const client = await this.client();
    await client.set(PUBLISHED_STATUS_KEY, JSON.stringify(record));
  }

  async published(
    now = new Date(),
  ): Promise<Partial<Record<Store, PublishedStoreStatus>>> {
    const client = await this.client();
    const record = parseRecord(await client.get(PUBLISHED_STATUS_KEY));
    if (!record) return {};
    return isFresh(record.fetchedAt, now) ? record.stores : {};
  }

  private resolveTarget(raw: string | undefined): URL | null {
    if (!raw) return null;
    try {
      return assertDeliverableUrl(raw);
    } catch (error) {
      this.logger.warn(
        `STORE_STATUS_URL is not usable, so no status is polled: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async download(target: URL): Promise<unknown> {
    try {
      const response = await fetch(target, {
        method: 'GET',
        dispatcher: this.dispatcher,
        redirect: 'manual',
        signal: AbortSignal.timeout(PUBLISHED_STATUS_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(
          `${target.href} answered ${response.status}, so nothing changed`,
        );
        return null;
      }
      const body = await readCapped(response);
      if (body === null) {
        this.logger.warn(
          `${target.href} sent more than ${PUBLISHED_STATUS_MAX_BYTES} bytes, so it was not read`,
        );
        return null;
      }
      const parsed: unknown = JSON.parse(body);
      return parsed;
    } catch (error) {
      this.logger.warn(
        `${target.href} could not be read, so nothing changed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private client(): Promise<PublishedKeyValue> {
    return this.queue.getBackend().client;
  }
}

async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > PUBLISHED_STATUS_MAX_BYTES) {
    return null;
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined =
    response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > PUBLISHED_STATUS_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function parseRecord(stored: string | null): PublishedStatusRecord | null {
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is PublishedStatusRecord {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PublishedStatusRecord>;
  return (
    typeof candidate.fetchedAt === 'string' &&
    typeof candidate.stores === 'object' &&
    candidate.stores !== null
  );
}

function isFresh(fetchedAt: string, now: Date): boolean {
  const at = new Date(fetchedAt).getTime();
  if (Number.isNaN(at)) return false;
  return now.getTime() - at < PUBLISHED_STATUS_MAX_AGE_HOURS * HOUR_MS;
}
