import { EventEmitter } from 'node:events';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { OCR_LANGUAGES } from './ocr-languages';
import { OCR_THREAD, type OcrReply, type OcrRequest } from './ocr-thread';
import { disposeTessdata, tessdataDirectory } from './tessdata';
import {
  IDLE_TERMINATE_MS,
  RECOGNIZE_TIMEOUT_MS,
  TesseractOcrEngine,
} from './tesseract.engine';

type Answer = (request: OcrRequest, thread: FakeThread) => void;

const threads: FakeThread[] = [];
const answers: Answer[] = [];

class FakeThread extends EventEmitter {
  readonly requests: OcrRequest[] = [];
  readonly terminate = jest.fn(() => {
    this.emit('exit', 1);
    return Promise.resolve(1);
  });

  constructor(
    readonly file: string,
    readonly options: { workerData: unknown },
  ) {
    super();
    threads.push(this);
  }

  postMessage(request: OcrRequest): void {
    this.requests.push(request);
    const answer = answers.shift() ?? replyWith({ lines: LINES });
    setImmediate(() => answer(request, this));
  }
}

jest.mock('node:worker_threads', () => ({
  Worker: jest.fn((file: string, options: { workerData: unknown }) => {
    return new FakeThread(file, options);
  }),
}));
jest.mock('./tessdata', () => ({
  tessdataDirectory: jest.fn().mockResolvedValue('/tmp/tessdata'),
  disposeTessdata: jest.fn().mockResolvedValue(undefined),
}));

const LINES = [
  {
    text: 'Track every habit',
    confidence: 96,
    left: 0,
    top: 198,
    width: 900,
    height: 102,
  },
];

const replyWith =
  (reply: OcrReply): Answer =>
  (_request, thread) =>
    thread.emit('message', reply);

const never: Answer = () => undefined;

const config = {
  get: () => OCR_LANGUAGES,
} as unknown as ConfigService<Env, true>;

describe('TesseractOcrEngine', () => {
  let engine: TesseractOcrEngine;

  beforeEach(() => {
    threads.length = 0;
    answers.length = 0;
    jest.mocked(tessdataDirectory).mockClear();
    engine = new TesseractOcrEngine(config);
  });

  afterEach(() => jest.useRealTimers());

  it('names itself so cached text records which engine read it', () => {
    expect(engine.name).toBe('tesseract.js-7');
  });

  it('reads in a thread of its own on the local language path', async () => {
    await expect(
      engine.read(Buffer.from('x'), ['eng', 'jpn'], 'sauvola'),
    ).resolves.toEqual(LINES);

    expect(tessdataDirectory).toHaveBeenCalledWith(OCR_LANGUAGES);
    expect(threads).toHaveLength(1);
    expect(threads[0].file).toMatch(/ocr-thread\.ts$/);
    expect(threads[0].options).toEqual({ workerData: OCR_THREAD });
    expect(threads[0].requests[0]).toEqual({
      image: Buffer.from('x'),
      languages: ['eng', 'jpn'],
      thresholding: 'sauvola',
      langPath: '/tmp/tessdata',
    });
  });

  it('keeps one thread across reads', async () => {
    await engine.read(Buffer.from('x'), ['eng'], 'otsu');
    await engine.read(Buffer.from('x'), ['eng'], 'otsu');

    expect(threads).toHaveLength(1);
  });

  it('runs reads one at a time', async () => {
    let release: () => void = () => undefined;
    answers.push((_request, thread) => {
      release = () => thread.emit('message', { lines: [] });
    });

    const first = engine.read(Buffer.from('1'), ['eng'], 'otsu');
    const second = engine.read(Buffer.from('2'), ['eng'], 'otsu');
    for (let turn = 0; turn < 50 && threads.length === 0; turn++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    await new Promise((resolve) => setImmediate(resolve));
    expect(threads[0].requests).toHaveLength(1);

    release();
    await Promise.all([first, second]);
    expect(threads[0].requests).toHaveLength(2);
  });

  it('fails a read the thread answered with an error and starts a new thread for the next one', async () => {
    answers.push(replyWith({ error: 'wasm out of memory' }));

    await expect(
      engine.read(Buffer.from('x'), ['eng'], 'otsu'),
    ).rejects.toThrow('wasm out of memory');
    expect(threads[0].terminate).toHaveBeenCalledTimes(1);

    await engine.read(Buffer.from('x'), ['eng'], 'otsu');
    expect(threads).toHaveLength(2);
  });

  it('fails a read whose thread crashed and keeps serving the next one', async () => {
    answers.push((_request, thread) => {
      thread.emit('error', new Error('unexpected end of file'));
      thread.emit('exit', 1);
    });

    await expect(
      engine.read(Buffer.from('x'), ['eng'], 'otsu'),
    ).rejects.toThrow('unexpected end of file');

    await expect(
      engine.read(Buffer.from('x'), ['eng'], 'otsu'),
    ).resolves.toEqual(LINES);
    expect(threads).toHaveLength(2);
  });

  it('fails a read whose thread exited without an answer', async () => {
    answers.push((_request, thread) => thread.emit('exit', 1));

    await expect(
      engine.read(Buffer.from('x'), ['eng'], 'otsu'),
    ).rejects.toThrow('the ocr thread exited with code 1');
  });

  it('survives a thread that fails while it is idle', async () => {
    await engine.read(Buffer.from('x'), ['eng'], 'otsu');

    threads[0].emit('error', new Error('late failure'));
    threads[0].emit('exit', 1);

    await engine.read(Buffer.from('x'), ['eng'], 'otsu');
    expect(threads).toHaveLength(2);
  });

  it('gives up on a read that hangs and starts a new thread for the next one', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    answers.push(never);

    const hung = engine.read(Buffer.from('x'), ['eng'], 'otsu');
    const outcome = expect(hung).rejects.toThrow(`${RECOGNIZE_TIMEOUT_MS} ms`);
    await jest.advanceTimersByTimeAsync(RECOGNIZE_TIMEOUT_MS);
    await outcome;
    expect(threads[0].terminate).toHaveBeenCalledTimes(1);

    await expect(
      engine.read(Buffer.from('x'), ['eng'], 'otsu'),
    ).resolves.toEqual(LINES);
    expect(threads).toHaveLength(2);
  });

  it('gives the memory back after the idle period and on shutdown', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    await engine.read(Buffer.from('x'), ['eng'], 'otsu');

    await jest.advanceTimersByTimeAsync(IDLE_TERMINATE_MS);
    expect(threads[0].terminate).toHaveBeenCalledTimes(1);

    await engine.read(Buffer.from('x'), ['eng'], 'otsu');
    await engine.onModuleDestroy();
    expect(threads[1].terminate).toHaveBeenCalledTimes(1);
    expect(disposeTessdata).toHaveBeenCalled();
  });

  it('starts no thread once the module is shutting down', async () => {
    await engine.onModuleDestroy();

    await expect(
      engine.read(Buffer.from('x'), ['eng'], 'otsu'),
    ).rejects.toThrow('shutting down');
    expect(threads).toHaveLength(0);
    expect(tessdataDirectory).not.toHaveBeenCalled();
  });

  it('starts no thread when shutdown began while the language path was prepared', async () => {
    let prepared: (path: string) => void = () => undefined;
    jest.mocked(tessdataDirectory).mockReturnValueOnce(
      new Promise((resolve) => {
        prepared = resolve;
      }),
    );

    const read = engine.read(Buffer.from('x'), ['eng'], 'otsu');
    const outcome = expect(read).rejects.toThrow('shutting down');
    await new Promise((resolve) => setImmediate(resolve));
    await engine.onModuleDestroy();
    prepared('/tmp/tessdata');

    await outcome;
    expect(threads).toHaveLength(0);
  });
});
