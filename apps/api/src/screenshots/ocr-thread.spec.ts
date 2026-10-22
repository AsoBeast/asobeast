import { EventEmitter } from 'node:events';
import { createWorker } from 'tesseract.js';
import {
  serve,
  type OcrPort,
  type OcrReply,
  type OcrRequest,
} from './ocr-thread';

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  OEM: { LSTM_ONLY: 1 },
  PSM: { SPARSE_TEXT: 11 },
}));

const createWorkerMock = createWorker as unknown as jest.Mock<
  Promise<unknown>,
  [string[], number, Record<string, unknown>, Record<string, unknown>]
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

class FakePort extends EventEmitter {
  readonly replies: OcrReply[] = [];
  private answered: (() => void) | null = null;

  postMessage(reply: OcrReply): void {
    this.replies.push(reply);
    this.answered?.();
  }

  ask(request: Partial<OcrRequest> = {}): Promise<OcrReply> {
    const count = this.replies.length;
    const replied = new Promise<void>((resolve) => {
      this.answered = resolve;
    });
    this.emit('message', {
      image: new Uint8Array([1]),
      languages: ['eng'],
      thresholding: 'otsu',
      langPath: '/tmp/tessdata',
      ...request,
    });
    return replied.then(() => this.replies[count]);
  }
}

describe('the ocr thread', () => {
  let worker: ReturnType<typeof fakeWorker>;
  let port: FakePort;

  beforeEach(() => {
    worker = fakeWorker();
    createWorkerMock.mockReset().mockResolvedValue(worker);
    port = new FakePort();
    serve(port as unknown as OcrPort);
  });

  it('creates one worker on the local language path and never a remote one', async () => {
    await port.ask();

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    const [languages, , options] = createWorkerMock.mock.calls[0];
    expect(languages).toEqual(['eng']);
    expect(options).toMatchObject({
      langPath: '/tmp/tessdata',
      gzip: true,
      cacheMethod: 'none',
    });
  });

  it('maps lines to text, confidence and their box', async () => {
    await expect(port.ask()).resolves.toEqual({
      lines: [
        {
          text: 'Track every habit',
          confidence: 96,
          left: 0,
          top: 198,
          width: 900,
          height: 102,
        },
      ],
    });
  });

  it('reads with sparse text segmentation and the thresholding of the pass', async () => {
    await port.ask();

    expect(worker.setParameters).toHaveBeenCalledWith({
      tessedit_pageseg_mode: 11,
      thresholding_method: '0',
    });
  });

  it('reuses the worker for the same languages and reinitialises for others', async () => {
    await port.ask();
    await port.ask();
    expect(worker.reinitialize).not.toHaveBeenCalled();

    await port.ask({ languages: ['eng', 'jpn'] });

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(worker.reinitialize).toHaveBeenCalledWith('eng+jpn', 1);
  });

  it('switches to sauvola for the inverted pass and back to otsu without reloading the languages', async () => {
    await port.ask();
    await port.ask({ thresholding: 'sauvola' });

    expect(worker.setParameters).toHaveBeenLastCalledWith({
      tessedit_pageseg_mode: 11,
      thresholding_method: '2',
    });

    await port.ask();

    expect(worker.setParameters).toHaveBeenLastCalledWith({
      tessedit_pageseg_mode: 11,
      thresholding_method: '0',
    });
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(worker.reinitialize).not.toHaveBeenCalled();
  });

  it('answers a failed read with its reason and builds a new worker for the next one', async () => {
    worker.recognize.mockRejectedValueOnce(new Error('wasm out of memory'));

    await expect(port.ask()).resolves.toEqual({ error: 'wasm out of memory' });
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    await port.ask();
    expect(createWorkerMock).toHaveBeenCalledTimes(2);
  });

  it('answers a worker that could not start with its reason', async () => {
    createWorkerMock.mockRejectedValueOnce('initialization failed');

    await expect(port.ask()).resolves.toEqual({
      error: 'initialization failed',
    });
  });
});
