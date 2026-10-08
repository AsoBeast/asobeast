import { ConfigService } from '@nestjs/config';
import { createWorker } from 'tesseract.js';
import type { Env } from '../config/env';
import { OCR_LANGUAGES } from './ocr-languages';
import { disposeTessdata, tessdataDirectory } from './tessdata';
import {
  IDLE_TERMINATE_MS,
  RECOGNIZE_TIMEOUT_MS,
  TesseractOcrEngine,
} from './tesseract.engine';

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  OEM: { LSTM_ONLY: 1 },
  PSM: { SPARSE_TEXT: 11 },
}));
jest.mock('./tessdata', () => ({
  tessdataDirectory: jest.fn().mockResolvedValue('/tmp/tessdata'),
  disposeTessdata: jest.fn().mockResolvedValue(undefined),
}));

const createWorkerMock = createWorker as unknown as jest.Mock<
  Promise<unknown>,
  [string[], number, Record<string, unknown>]
>;

const page = (text = 'Track every habit') => ({
  data: {
    blocks: [
      {
        paragraphs: [
          {
            lines: [
              {
                text,
                confidence: 96,
                bbox: { x0: 0, y0: 198, x1: 900, y1: 300 },
              },
            ],
          },
        ],
      },
    ],
  },
});

const fakeWorker = () => ({
  recognize: jest.fn().mockResolvedValue(page()),
  reinitialize: jest.fn().mockResolvedValue(undefined),
  setParameters: jest.fn().mockResolvedValue(undefined),
  terminate: jest.fn().mockResolvedValue(undefined),
});

const config = {
  get: () => OCR_LANGUAGES,
} as unknown as ConfigService<Env, true>;

describe('TesseractOcrEngine', () => {
  let worker: ReturnType<typeof fakeWorker>;
  let engine: TesseractOcrEngine;

  beforeEach(() => {
    jest.useFakeTimers();
    worker = fakeWorker();
    createWorkerMock.mockReset().mockResolvedValue(worker);
    engine = new TesseractOcrEngine(config);
  });

  afterEach(() => jest.useRealTimers());

  it('creates one worker on a local language path and never a remote one', async () => {
    await engine.read(Buffer.from('x'), ['eng']);

    expect(tessdataDirectory).toHaveBeenCalledWith(OCR_LANGUAGES);
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    const [languages, , options] = createWorkerMock.mock.calls[0];
    expect(languages).toEqual(['eng']);
    expect(options).toMatchObject({
      langPath: '/tmp/tessdata',
      gzip: true,
      cacheMethod: 'none',
    });
  });

  it('names itself so cached text records which engine read it', () => {
    expect(engine.name).toBe('tesseract.js-7');
  });

  it('maps lines to text, confidence and their box', async () => {
    const lines = await engine.read(Buffer.from('x'), ['eng']);

    expect(lines).toEqual([
      {
        text: 'Track every habit',
        confidence: 96,
        left: 0,
        top: 198,
        width: 900,
        height: 102,
      },
    ]);
  });

  it('reads with sparse text segmentation', async () => {
    await engine.read(Buffer.from('x'), ['eng']);

    expect(worker.setParameters).toHaveBeenCalledWith({
      tessedit_pageseg_mode: 11,
    });
  });

  it('reuses the worker for the same languages and reinitialises for others', async () => {
    await engine.read(Buffer.from('x'), ['eng']);
    await engine.read(Buffer.from('x'), ['eng']);
    expect(worker.reinitialize).not.toHaveBeenCalled();

    await engine.read(Buffer.from('x'), ['eng', 'jpn']);

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(worker.reinitialize).toHaveBeenCalledWith('eng+jpn', 1);
  });

  it('runs reads one at a time', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    worker.recognize
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => {
              order.push('first done');
              resolve(page('one'));
            };
          }),
      )
      .mockImplementationOnce(() => {
        order.push('second started');
        return Promise.resolve(page('two'));
      });

    const first = engine.read(Buffer.from('1'), ['eng']);
    const second = engine.read(Buffer.from('2'), ['eng']);
    for (
      let turn = 0;
      turn < 50 && worker.recognize.mock.calls.length === 0;
      turn++
    ) {
      await Promise.resolve();
    }
    release();
    await Promise.all([first, second]);

    expect(order).toEqual(['first done', 'second started']);
  });

  it('discards a worker that failed and builds a new one for the next read', async () => {
    worker.recognize.mockRejectedValueOnce(new Error('wasm out of memory'));

    await expect(engine.read(Buffer.from('x'), ['eng'])).rejects.toThrow(
      'wasm out of memory',
    );
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    await engine.read(Buffer.from('x'), ['eng']);
    expect(createWorkerMock).toHaveBeenCalledTimes(2);
  });

  it('gives the memory back after the idle period and on shutdown', async () => {
    await engine.read(Buffer.from('x'), ['eng']);

    await jest.advanceTimersByTimeAsync(IDLE_TERMINATE_MS);
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    await engine.read(Buffer.from('x'), ['eng']);
    await engine.onModuleDestroy();
    expect(worker.terminate).toHaveBeenCalledTimes(2);
    expect(disposeTessdata).toHaveBeenCalled();
  });

  it('gives up on a read that hangs and builds a new worker for the next one', async () => {
    worker.recognize.mockImplementationOnce(() => new Promise(() => undefined));

    const hung = engine.read(Buffer.from('x'), ['eng']);
    const outcome = expect(hung).rejects.toThrow(`${RECOGNIZE_TIMEOUT_MS} ms`);
    await jest.advanceTimersByTimeAsync(RECOGNIZE_TIMEOUT_MS);
    await outcome;
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    await expect(engine.read(Buffer.from('x'), ['eng'])).resolves.toHaveLength(
      1,
    );
    expect(createWorkerMock).toHaveBeenCalledTimes(2);
  });

  it('builds no worker once the module is shutting down', async () => {
    await engine.onModuleDestroy();
    jest.mocked(tessdataDirectory).mockClear();

    await expect(engine.read(Buffer.from('x'), ['eng'])).rejects.toThrow(
      'shutting down',
    );
    expect(createWorkerMock).not.toHaveBeenCalled();
    expect(tessdataDirectory).not.toHaveBeenCalled();
  });

  it('terminates a worker that finished starting after shutdown began', async () => {
    let started: (value: unknown) => void = () => undefined;
    createWorkerMock.mockReturnValueOnce(
      new Promise((resolve) => {
        started = resolve;
      }),
    );

    const read = engine.read(Buffer.from('x'), ['eng']);
    const outcome = expect(read).rejects.toThrow('shutting down');
    await jest.advanceTimersByTimeAsync(0);
    await engine.onModuleDestroy();
    started(worker);

    await outcome;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.recognize).not.toHaveBeenCalled();
  });
});
