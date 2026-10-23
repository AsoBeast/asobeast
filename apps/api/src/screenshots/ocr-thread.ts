import { parentPort, type MessagePort } from 'node:worker_threads';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { OcrLine } from './caption-text';
import type { OcrThresholding } from './ocr-engine';
import type { OcrLanguage } from './ocr-languages';

export interface OcrRequest {
  image: Uint8Array;
  languages: OcrLanguage[];
  thresholding: OcrThresholding;
  langPath: string;
}

export type OcrReply = { lines: OcrLine[] } | { error: string };

export type OcrPort = Pick<MessagePort, 'on' | 'postMessage'>;

const THRESHOLDING: Record<OcrThresholding, string> = {
  otsu: '0',
  sauvola: '2',
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function serve(port: OcrPort): void {
  let worker: Worker | null = null;
  let configured = '';

  const workerFor = async ({
    languages,
    thresholding,
    langPath,
  }: OcrRequest): Promise<Worker> => {
    const joined = languages.join('+');
    if (worker === null) {
      worker = await createWorker([...languages], OEM.LSTM_ONLY, {
        langPath,
        gzip: true,
        cacheMethod: 'none',
      });
    } else if (configured !== joined) {
      await worker.reinitialize(joined, OEM.LSTM_ONLY);
    }
    configured = joined;
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      thresholding_method: THRESHOLDING[thresholding],
    });
    return worker;
  };

  const discard = async (): Promise<void> => {
    const current = worker;
    worker = null;
    configured = '';
    if (current !== null) await current.terminate().catch(() => undefined);
  };

  const read = async (request: OcrRequest): Promise<OcrLine[]> => {
    try {
      const { data } = await (
        await workerFor(request)
      ).recognize(Buffer.from(request.image), {}, { blocks: true });
      return (data.blocks ?? [])
        .flatMap((block) => block.paragraphs)
        .flatMap((paragraph) => paragraph.lines)
        .map((line) => ({
          text: line.text,
          confidence: line.confidence,
          left: line.bbox.x0,
          top: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        }));
    } catch (error) {
      await discard();
      throw error;
    }
  };

  port.on('message', (request: OcrRequest) => {
    read(request).then(
      (lines) => port.postMessage({ lines } satisfies OcrReply),
      (error: unknown) =>
        port.postMessage({ error: messageOf(error) } satisfies OcrReply),
    );
  });
}

if (parentPort !== null) serve(parentPort);
