import type { Request } from 'express';

export function pathWithoutQuery(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

export function withoutQueryEcho<T extends { message: string }>(
  error: T,
  request: Pick<Request, 'method' | 'originalUrl'>,
): T {
  const echoed = `Cannot ${request.method} ${request.originalUrl}`;
  return error.message === echoed
    ? {
        ...error,
        message: `Cannot ${request.method} ${pathWithoutQuery(request.originalUrl)}`,
      }
    : error;
}
