import { Writable } from 'node:stream';
import {
  EXPORT_BATCH_CHARS,
  ExportSinkClosedError,
  ExportStalledError,
  writeBatched,
} from './export-sink';

function* linesOf(...lines: string[]): Generator<string> {
  yield* lines;
}

function collector() {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      setImmediate(callback);
    },
  });
  return { chunks, sink };
}

describe('writeBatched', () => {
  it('writes every line in order and groups them into batches', async () => {
    const { chunks, sink } = collector();
    const line = `${'x'.repeat(EXPORT_BATCH_CHARS / 2 - 1)}\n`;

    await writeBatched(sink, linesOf(line, line, line));

    expect(chunks.join('')).toBe(line.repeat(3));
    expect(chunks).toHaveLength(2);
  });

  it('writes nothing for no lines', async () => {
    const { chunks, sink } = collector();

    await writeBatched(sink, linesOf());

    expect(chunks).toEqual([]);
  });

  it('finishes when write returns false and drain is never emitted', async () => {
    const chunks: string[] = [];
    const sink = new Writable({
      highWaterMark: 1,
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        setImmediate(callback);
      },
    });
    const emit = sink.emit.bind(sink);
    sink.emit = ((event: string | symbol, ...args: unknown[]) =>
      event === 'drain' ? false : emit(event, ...args)) as Writable['emit'];
    const line = `${'x'.repeat(EXPORT_BATCH_CHARS)}\n`;

    await writeBatched(sink, linesOf(line, line, line), 1_000);

    expect(chunks.join('')).toBe(line.repeat(3));
  });

  it('rejects when the sink closes while a write is pending', async () => {
    const sink = new Writable({ write: () => undefined });
    const closing = writeBatched(sink, linesOf('a\n'));
    await new Promise((resolve) => setImmediate(resolve));

    sink.destroy();

    await expect(closing).rejects.toBeInstanceOf(ExportSinkClosedError);
  });

  it('rejects at once when the sink is already destroyed', async () => {
    const sink = new Writable({ write: () => undefined });
    sink.destroy();

    await expect(writeBatched(sink, linesOf('a\n'))).rejects.toBeInstanceOf(
      ExportSinkClosedError,
    );
  });

  it('reports a write error of a destroyed sink as a closed sink', async () => {
    const sink = new Writable({
      write(_chunk, _encoding, callback) {
        this.destroy();
        callback(new Error('EPIPE'));
      },
    });
    sink.on('error', () => undefined);

    await expect(writeBatched(sink, linesOf('a\n'))).rejects.toBeInstanceOf(
      ExportSinkClosedError,
    );
  });

  it('passes on the write error of a sink that is still open', async () => {
    const sink = new Writable({
      write(_chunk, _encoding, callback) {
        callback(new Error('disk on fire'));
      },
    });
    sink.on('error', () => undefined);

    await expect(writeBatched(sink, linesOf('a\n'))).rejects.toThrow(
      'disk on fire',
    );
  });

  it('rejects with a stalled error when the sink accepts nothing', async () => {
    const sink = new Writable({ write: () => undefined });

    await expect(writeBatched(sink, linesOf('a\n'), 20)).rejects.toBeInstanceOf(
      ExportStalledError,
    );
  });

  it('stops pulling lines after the sink fails', async () => {
    const sink = new Writable({ write: () => undefined });
    let finished = false;
    function* lines(): Generator<string> {
      try {
        for (;;) yield `${'x'.repeat(EXPORT_BATCH_CHARS)}\n`;
      } finally {
        finished = true;
      }
    }

    await expect(writeBatched(sink, lines(), 20)).rejects.toBeInstanceOf(
      ExportStalledError,
    );
    expect(finished).toBe(true);
  });
});
