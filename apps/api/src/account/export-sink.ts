import type { Writable } from 'node:stream';

export const EXPORT_BATCH_CHARS = 64 * 1024;
export const EXPORT_FLUSH_TIMEOUT_MS = 60_000;
const CONNECTION_LOST_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'EPIPE']);

export class ExportSinkClosedError extends Error {
  constructor(options?: ErrorOptions) {
    super('the export connection closed before the archive was sent', options);
    this.name = 'ExportSinkClosedError';
  }
}

export class ExportStalledError extends Error {
  constructor(timeoutMs: number) {
    super(`the export connection accepted no data for ${timeoutMs} ms`);
    this.name = 'ExportStalledError';
  }
}

function exportErrorOf(sink: Writable, error: Error): Error {
  const { code } = error as NodeJS.ErrnoException;
  const lost = code !== undefined && CONNECTION_LOST_CODES.has(code);
  return sink.destroyed || lost
    ? new ExportSinkClosedError({ cause: error })
    : error;
}

function flush(
  sink: Writable,
  batch: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sink.destroyed) {
      reject(new ExportSinkClosedError());
      return;
    }
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      sink.off('close', onClose);
      sink.off('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onClose = (): void => finish(new ExportSinkClosedError());
    const onError = (error: Error): void => finish(exportErrorOf(sink, error));
    const timer = setTimeout(
      () => finish(new ExportStalledError(timeoutMs)),
      timeoutMs,
    );
    sink.once('close', onClose);
    sink.once('error', onError);
    sink.write(batch, (error) => (error ? onError(error) : finish()));
  });
}

export async function writeBatched(
  sink: Writable,
  lines: AsyncIterable<string> | Iterable<string>,
  timeoutMs = EXPORT_FLUSH_TIMEOUT_MS,
): Promise<void> {
  let failure: Error | undefined;
  const remember = (error: Error): void => {
    failure ??= error;
  };
  const deliver = (batch: string): Promise<void> =>
    failure === undefined
      ? flush(sink, batch, timeoutMs)
      : Promise.reject(exportErrorOf(sink, failure));
  sink.on('error', remember);
  try {
    let batch = '';
    for await (const line of lines) {
      batch += line;
      if (batch.length >= EXPORT_BATCH_CHARS) {
        await deliver(batch);
        batch = '';
      }
    }
    if (batch.length > 0) await deliver(batch);
  } finally {
    sink.off('error', remember);
  }
}
