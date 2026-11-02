import { setTimeout as sleep } from 'node:timers/promises';
import { AscError, errorOf } from './asc-errors';
import type { AscTokenCache } from './asc-token';
import {
  ASC_ORIGIN,
  type AscRequest,
  type AscResponse,
  type AscTransport,
} from './asc-transport';

export const ASC_RETRY_PAUSE_MS = 2_000;

export interface Resource<T> {
  id: string;
  attributes?: T;
}

interface Page<T> {
  data: Resource<T>[];
  links?: { next?: string };
}

const UNREADABLE_ANSWER =
  'App Store Connect answered with something AsoBeast could not read';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isResource = (value: unknown): boolean =>
  isRecord(value) && typeof value.id === 'string' && value.id.length > 0;

const unreadable = (): AscError => new AscError(UNREADABLE_ANSWER, 502, null);

function readablePage<T>(body: unknown): Page<T> {
  if (
    !isRecord(body) ||
    !Array.isArray(body.data) ||
    !body.data.every(isResource)
  ) {
    throw unreadable();
  }
  return body as unknown as Page<T>;
}

export function createdResource<T>(response: AscResponse): Resource<T> {
  const { body } = response;
  if (!isRecord(body) || !isResource(body.data)) throw unreadable();
  return body.data as Resource<T>;
}

const isServerError = (response: AscResponse): boolean =>
  response.status >= 500;

const isSuccess = (response: AscResponse): boolean =>
  response.status >= 200 && response.status < 300;

function nextPath(next: string | undefined): string | null {
  if (!next) return null;
  const url = new URL(next);
  if (url.origin !== ASC_ORIGIN) {
    throw new AscError(
      'App Store Connect answered a next page on another host',
      502,
      null,
    );
  }
  return `${url.pathname}${url.search}`;
}

export class AscRequester {
  constructor(
    private readonly transport: AscTransport,
    private readonly tokens: AscTokenCache,
    private readonly pause: (ms: number) => Promise<unknown> = sleep,
  ) {}

  async page<T>(path: string): Promise<Resource<T>[]> {
    const items: Resource<T>[] = [];
    for await (const page of this.pages<T>(path)) items.push(...page);
    return items;
  }

  async *pages<T>(path: string): AsyncGenerator<Resource<T>[]> {
    let next: string | null = path;
    while (next) {
      const response = await this.send({ method: 'GET', path: next });
      const page = readablePage<T>(response.body);
      yield page.data;
      next = nextPath(page.links?.next);
    }
  }

  async send(request: AscRequest, retry = true): Promise<AscResponse> {
    const signed =
      request.absoluteUrl === undefined
        ? { ...request, token: this.tokens.get() }
        : request;
    let response = await this.transport(signed);
    if (retry && isServerError(response)) {
      await this.pause(ASC_RETRY_PAUSE_MS);
      response = await this.transport(signed);
    }
    if (!isSuccess(response)) throw errorOf(response, request);
    return response;
  }
}
