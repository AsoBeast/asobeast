import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export interface InProcessResponse {
  status: number;
  body: unknown;
}

export type RequestListener = (
  req: IncomingMessage,
  res: ServerResponse,
) => void;

export const DISPATCH_TIMEOUT_MS = 30_000;

const GATEWAY_TIMEOUT = 504;
const INTERNAL_ERROR = 500;

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

function parse(chunks: Buffer[]): unknown {
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function dispatchGet(
  listener: RequestListener,
  url: string,
  headers: Record<string, string | undefined>,
  timeoutMs = DISPATCH_TIMEOUT_MS,
): Promise<InProcessResponse> {
  return new Promise((resolve) => {
    const req = new IncomingMessage(new Socket());
    req.method = 'GET';
    req.url = url;
    for (const [name, value] of Object.entries(headers)) {
      if (value !== undefined) req.headers[name] = value;
    }
    req.push(null);

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

  get(
    url: string,
    headers: Record<string, string | undefined>,
  ): Promise<InProcessResponse> {
    return dispatchGet(
      this.adapterHost.httpAdapter.getInstance<RequestListener>(),
      url,
      headers,
    );
  }
}
