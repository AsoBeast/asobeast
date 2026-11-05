import { decodeCursor, encodeCursor } from './alert-event-cursor';

const base64url = (value: string) => Buffer.from(value).toString('base64url');

describe('alert event cursor', () => {
  const row = {
    createdAt: new Date('2026-11-03T10:15:30.123Z'),
    id: 'cm3abc_DEF-123',
  };

  it('round trips the instant to the millisecond and the id', () => {
    expect(decodeCursor(encodeCursor(row))).toEqual(row);
  });

  it('writes a url safe value', () => {
    expect(encodeCursor(row)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['an empty value', ''],
    ['text that is not base64', 'not base64 !!'],
    ['a value without a separator', base64url('x')],
    ['an impossible instant', base64url('2026-13-40T00:00:00.000Z|abc')],
    ['an instant that is not canonical', base64url('2026-11-03|abc')],
    ['an empty id', base64url('2026-11-03T00:00:00.000Z|')],
    ['an id with a space', base64url('2026-11-03T00:00:00.000Z|a b')],
    ['a value over the length cap', 'a'.repeat(201)],
  ])('refuses %s', (_case, value) => {
    expect(decodeCursor(value)).toBeNull();
  });
});
