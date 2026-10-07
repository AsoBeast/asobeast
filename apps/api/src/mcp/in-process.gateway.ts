import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { JsonBody, ResolvedRequest } from '@asobeast/mcp-tools';

export interface InProcessResponse {
  status: number;
  body: unknown;
}

export interface GatewayRequest {
  method: ResolvedRequest['method'];
  url: string;
  headers: Record<string, string | undefined>;
  body?: JsonBody;
}

export type RequestListener = (
  req: IncomingMessage,
  res: ServerResponse,
) => void;

export const DISPATCH_TIMEOUT_MS = 30_000;

const GATEWAY_TIMEOUT = 504;
const INTERNAL_ERROR = 500;
const JSON_CONTENT_TYPE = 'application/json';

type Chunk = string | Buffer | Uint8Array | null | undefined;

function failure(status: number, detail: string): InProcessResponse {
  return {
    status,
    body: { message: `The asobeast API could not serve this tool: ${detail}.` },
  };
}

function collect(res: ServerResponse, chunks: Buffer[]): void {
  const push = (chunk: Chunk): void => {
    if (chunk === null || chunk === undefined) return;
    chunks.push(Buffer.from(chunk as Buffer));
  };
  const settle = (...args: unknown[]): void => {
    const callback = args.find((arg) => typeof arg === 'function');
    if (callback) (callback as () => void)();
  };

  res.write = ((chunk: Chunk, ...args: unknown[]) => {
    push(chunk);
    settle(...args);
    return true;
  }) as ServerResponse['write'];

  res.end = ((chunk: Chunk, ...args: unknown[]) => {
    if (typeof chunk !== 'function') push(chunk);
    settle(chunk, ...args);
    res.emit('finish');
    return res;
  }) as ServerResponse['end'];
}

function carry(req: IncomingMessage, body: JsonBody | undefined): void {
  if (body === undefined) {
    req.push(null);
    return;
  }
  const payload = Buffer.from(JSON.stringify(body));
  req.headers['content-type'] = JSON_CONTENT_TYPE;
  req.headers['content-length'] = String(payload.length);
  req.push(payload);
  req.push(null);
}

function parse(chunks: Buffer[]): unknown {
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function dispatchRequest(
  listener: RequestListener,
  { method, url, headers, body }: GatewayRequest,
  timeoutMs = DISPATCH_TIMEOUT_MS,
): Promise<InProcessResponse> {
  return new Promise((resolve) => {
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = url;
    for (const [name, value] of Object.entries(headers)) {
      if (value !== undefined) req.headers[name] = value;
    }
    carry(req, body);

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    collect(res, chunks);

    let settled = false;
    const settle = (response: InProcessResponse): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    };
    const timer = setTimeout(
      () => settle(failure(GATEWAY_TIMEOUT, `${url} did not answer`)),
      timeoutMs,
    );
    timer.unref();

    res.once('finish', () =>
      settle({ status: res.statusCode, body: parse(chunks) }),
    );

    try {
      listener(req, res);
    } catch {
      settle(failure(INTERNAL_ERROR, `${url} failed before it answered`));
    }
  });
}

@Injectable()
export class InProcessGateway {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  send(request: GatewayRequest): Promise<InProcessResponse> {
    return dispatchRequest(
      this.adapterHost.httpAdapter.getInstance<RequestListener>(),
      request,
    );
  }
}
