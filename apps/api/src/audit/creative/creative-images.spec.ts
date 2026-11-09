import { AiContentPart, AiRequestError } from '../../ai/openai.client';
import { ScreenshotFetchError } from '../../store-providers/errors';
import { ScreenshotImageSource } from '../../store-providers/screenshot-image.source';
import { CreativeImages, LISTING_IMAGE_UNAVAILABLE } from './creative-images';

const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/a/512x512bb.jpg';
const SHOT = 'https://play-lh.googleusercontent.com/AbC=w526-h296-rw';
const ELSEWHERE = 'https://images.example.com/shot.png';

const parts: AiContentPart[] = [
  { type: 'text', text: 'App icon:' },
  { type: 'image', url: ICON, detail: 'low' },
  { type: 'text', text: 'Screenshots, in order:' },
  { type: 'image', url: SHOT, detail: 'high' },
];

const imagesOf = (readListed: jest.Mock) =>
  new CreativeImages({ readListed } as unknown as ScreenshotImageSource);

const refusal = async (readListed: jest.Mock): Promise<AiRequestError> => {
  try {
    await imagesOf(readListed).inline(parts);
  } catch (error) {
    return error as AiRequestError;
  }
  throw new Error('expected the inlining to fail');
};

describe('CreativeImages', () => {
  it('replaces each store image address with its downloaded bytes and keeps the rest', async () => {
    const readListed = jest.fn((url: string) =>
      Promise.resolve(
        url === ICON
          ? { bytes: Buffer.from([1, 2, 3]), mediaType: 'image/jpeg' }
          : { bytes: Buffer.from([4, 5]), mediaType: 'image/webp' },
      ),
    );

    const inlined = await imagesOf(readListed).inline(parts);

    expect(inlined).toEqual([
      { type: 'text', text: 'App icon:' },
      { type: 'image', url: 'data:image/jpeg;base64,AQID', detail: 'low' },
      { type: 'text', text: 'Screenshots, in order:' },
      { type: 'image', url: 'data:image/webp;base64,BAU=', detail: 'high' },
    ]);
    expect(readListed.mock.calls).toEqual([[ICON], [SHOT]]);
  });

  it('sends an image on another host by its address without downloading it', async () => {
    const readListed = jest.fn();
    const elsewhere: AiContentPart = {
      type: 'image',
      url: ELSEWHERE,
      detail: 'high',
    };

    await expect(imagesOf(readListed).inline([elsewhere])).resolves.toEqual([
      elsewhere,
    ]);
    expect(readListed).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'names the listing image when its download fails, retryable %s',
    async (retryable) => {
      const readListed = jest
        .fn()
        .mockResolvedValueOnce({
          bytes: Buffer.from([1]),
          mediaType: 'image/jpeg',
        })
        .mockRejectedValueOnce(
          new ScreenshotFetchError('the image request answered 404', retryable),
        );

      const failure = await refusal(readListed);

      expect(failure).toBeInstanceOf(AiRequestError);
      expect(failure.message).toBe(LISTING_IMAGE_UNAVAILABLE);
      expect(failure.retryable).toBe(retryable);
    },
  );

  it('rethrows an error that is not a download failure', async () => {
    const broken = new Error('boom');

    await expect(
      imagesOf(jest.fn().mockRejectedValue(broken)).inline(parts),
    ).rejects.toBe(broken);
  });
});
