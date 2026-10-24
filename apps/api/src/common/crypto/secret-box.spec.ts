import { randomBytes } from 'node:crypto';
import { decodeSecretKey, SecretBox, SecretBoxError } from './secret-box';

const key = () => randomBytes(32);

const CONTEXT = 'store-connection:ws_1:APP_STORE';

describe('SecretBox', () => {
  it('opens what it sealed under its context', () => {
    const box = new SecretBox(key());

    expect(
      box.open(box.seal('-----BEGIN PRIVATE KEY-----', CONTEXT), CONTEXT),
    ).toBe('-----BEGIN PRIVATE KEY-----');
  });

  it('never repeats a sealed value for the same text', () => {
    const box = new SecretBox(key());

    expect(box.seal('same', CONTEXT)).not.toBe(box.seal('same', CONTEXT));
  });

  it('keeps the text out of the sealed value', () => {
    const box = new SecretBox(key());

    expect(box.seal('plain secret text', CONTEXT)).not.toContain('plain');
  });

  it('writes a versioned value of five dot separated parts', () => {
    const sealed = new SecretBox(key()).seal('x', CONTEXT);

    expect(sealed.split('.')).toHaveLength(5);
    expect(sealed.startsWith('v1.')).toBe(true);
  });

  it('refuses a value sealed for another context', () => {
    const box = new SecretBox(key());
    const sealed = box.seal('secret', CONTEXT);

    expect(() => box.open(sealed, 'store-connection:ws_2:APP_STORE')).toThrow(
      SecretBoxError,
    );
  });

  it('refuses a value that was changed', () => {
    const box = new SecretBox(key());
    const [version, id, iv, tag, body] = box.seal('secret', CONTEXT).split('.');
    const flipped = Buffer.from(body, 'base64url');
    flipped[0] ^= 1;

    expect(() =>
      box.open(
        [version, id, iv, tag, flipped.toString('base64url')].join('.'),
        CONTEXT,
      ),
    ).toThrow(SecretBoxError);
  });

  it.each(['', 'v1', 'v2.a.b.c.d', 'v1.a.b.c', 'v1.a.b.c.d.e', 'garbage'])(
    'refuses the malformed value %j',
    (sealed) => {
      expect(() => new SecretBox(key()).open(sealed, CONTEXT)).toThrow(
        SecretBoxError,
      );
    },
  );

  it('refuses a value sealed with a key it does not hold', () => {
    const sealed = new SecretBox(key()).seal('secret', CONTEXT);

    expect(() => new SecretBox(key()).open(sealed, CONTEXT)).toThrow(
      SecretBoxError,
    );
  });

  it('opens a value sealed with the previous key and reports it needs resealing', () => {
    const previous = key();
    const sealed = new SecretBox(previous).seal('secret', CONTEXT);
    const rotated = new SecretBox(key(), previous);

    expect(rotated.open(sealed, CONTEXT)).toBe('secret');
    expect(rotated.isCurrent(sealed)).toBe(false);
    expect(
      rotated.isCurrent(rotated.seal(rotated.open(sealed, CONTEXT), CONTEXT)),
    ).toBe(true);
  });

  it('does not leak the key into an error', () => {
    const material = key();
    const box = new SecretBox(material);
    let message = '';
    try {
      box.open('v1.zzzz.a.b.c', CONTEXT);
    } catch (error) {
      message = String(error);
    }

    expect(message).toContain('cannot be opened');
    expect(message).not.toContain(material.toString('base64'));
    expect(message).not.toContain(material.toString('hex'));
  });
});

describe('decodeSecretKey', () => {
  it('decodes 32 bytes of base64 and trims it', () => {
    const material = key();

    expect(decodeSecretKey(material.toString('base64'))).toEqual(material);
    expect(decodeSecretKey(` ${material.toString('base64')}\n`)).toEqual(
      material,
    );
  });

  it.each([
    ['16 bytes', randomBytes(16).toString('base64')],
    ['48 bytes', randomBytes(48).toString('base64')],
    ['empty', ''],
  ])('refuses a key of %s', (_, encoded) => {
    expect(() => decodeSecretKey(encoded)).toThrow(SecretBoxError);
  });
});
