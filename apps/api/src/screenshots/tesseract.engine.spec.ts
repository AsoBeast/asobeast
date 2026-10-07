import { ConfigService } from '@nestjs/config';
import { createWorker } from 'tesseract.js';
import type { Env } from '../config/env';
import { OCR_LANGUAGES } from './ocr-languages';
import { disposeTessdata, tessdataDirectory } from './tessdata';
import { IDLE_TERMINATE_MS, TesseractOcrEngine } from './tesseract.engine';

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

  it('maps lines to text, confidence, top and height', async () => {
    const lines = await engine.read(Buffer.from('x'), ['eng']);

    expect(lines).toEqual([
      { text: 'Track every habit', confidence: 96, top: 198, height: 102 },
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
});
