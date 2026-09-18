import { describe, expect, it } from 'vitest';

import { utf8ByteLength } from './limits';

describe('utf8ByteLength', () => {
  it.each([
    ['habit,tracker', 13],
    ['ą', 2],
    ['日本', 6],
    ['🎯', 4],
    ['', 0],
  ])('counts %s as %i bytes', (text, bytes) => {
    expect(utf8ByteLength(text)).toBe(bytes);
  });
});
