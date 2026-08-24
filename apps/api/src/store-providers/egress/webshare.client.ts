import { Injectable } from '@nestjs/common';
import { ProxyProtocol, ProxyTier } from '@prisma/client';
import { ProxyPoolConfig } from './proxy-pool.config';
import { ProxyProviderClient, UpstreamProxy } from './proxy-provider';

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const TIMEOUT_MS = 15_000;

const MIN_PORT = 1;
const MAX_PORT = 65_535;

interface WebshareProxy {
  id: string | number;
  proxy_address: string;
  port: number;
  valid: boolean;
  country_code?: string | null;
}

interface WebsharePage {
  proxies: UpstreamProxy[];
  next: string | null;
}

export class ProxyProviderError extends Error {
  constructor(provider: string, detail: string) {
    super(`${provider} proxy listing failed: ${detail}`);
    this.name = 'ProxyProviderError';
  }
}

@Injectable()
export class WebshareClient implements ProxyProviderClient {
  readonly provider = 'webshare';

  constructor(private readonly config: ProxyPoolConfig) {}

  async list(): Promise<UpstreamProxy[]> {
    const proxies: UpstreamProxy[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await this.page(page);
      proxies.push(...body.proxies);
      if (!body.next) break;
    }
    return proxies;
  }

  private async page(page: number): Promise<WebsharePage> {
    const url = `${this.config.apiUrl}/proxy/list/?mode=direct&page=${page}&page_size=${PAGE_SIZE}`;
    const response = await fetch(url, {
      headers: { Authorization: `Token ${this.config.apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((error: unknown) => {
      throw new ProxyProviderError(
        this.provider,
        `page ${page} did not answer within ${TIMEOUT_MS}ms: ${reason(error)}`,
      );
    });
    if (!response.ok) {
      throw new ProxyProviderError(
        this.provider,
        `status ${response.status} for page ${page}`,
      );
    }

    const body: unknown = await response.json().catch((error: unknown) => {
      throw new ProxyProviderError(
        this.provider,
        `page ${page} was not json: ${reason(error)}`,
      );
    });
    if (!isPage(body)) {
      throw new ProxyProviderError(
        this.provider,
        `page ${page} did not carry a results list`,
      );
    }

    const proxies: UpstreamProxy[] = [];
    body.results.forEach((entry, index) => {
      if (isRetired(entry)) return;
      if (!isProxyRow(entry)) {
        throw new ProxyProviderError(
          this.provider,
          `page ${page} entry ${index} is not a proxy the pool can trust`,
        );
      }
      proxies.push(toUpstreamProxy(entry));
    });
    return { proxies, next: body.next };
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPage(
  body: unknown,
): body is { results: unknown[]; next: string | null } {
  if (typeof body !== 'object' || body === null) return false;
  const page = body as { results?: unknown; next?: unknown };
  if (!Array.isArray(page.results)) return false;
  return typeof page.next === 'string' || page.next === null;
}

function isProxyRow(entry: unknown): entry is WebshareProxy {
  if (typeof entry !== 'object' || entry === null) return false;
  const row = entry as Record<string, unknown>;
  if (typeof row.id !== 'string' && typeof row.id !== 'number') return false;
  if (typeof row.proxy_address !== 'string') return false;
  if (row.proxy_address.trim() === '') return false;
  if (typeof row.valid !== 'boolean') return false;
  if (!isPortNumber(row.port)) return false;
  return (
    row.country_code === undefined ||
    row.country_code === null ||
    typeof row.country_code === 'string'
  );
}

function isPortNumber(port: unknown): boolean {
  if (typeof port !== 'number' || !Number.isInteger(port)) return false;
  return port >= MIN_PORT && port <= MAX_PORT;
}

function isRetired(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  return (entry as { valid?: unknown }).valid === false;
}

function toUpstreamProxy(proxy: WebshareProxy): UpstreamProxy {
  return {
    externalId: String(proxy.id),
    host: proxy.proxy_address,
    port: proxy.port,
    protocol: ProxyProtocol.HTTP,
    tier: ProxyTier.DATACENTER,
    ...(proxy.country_code
      ? { country: proxy.country_code.toLowerCase() }
      : {}),
  };
}
