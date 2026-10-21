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
  data?: Resource<T>[];
  links?: { next?: string };
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
    let next: string | null = path;
    while (next) {
      const response = await this.send({ method: 'GET', path: next });
      const page = (response.body ?? {}) as Page<T>;
      items.push(...(page.data ?? []));
      next = nextPath(page.links?.next);
    }
    return items;
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
