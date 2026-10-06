import {
  ArgumentMetadata,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { HashedOnly } from './hashed-only.decorator';
import { StorableTextPipe } from './storable-text.pipe';

const NUL = '\u0000';
const DEEPEST = 100_000;
const DEEPEST_ALLOWED = 64;
const TOO_DEEP = 'must not be nested more than 64 levels deep';

const pipe = new StorableTextPipe();

class Credentials {
  @HashedOnly()
  password!: string;

  name!: string;
}

class ExtendedCredentials extends Credentials {
  @HashedOnly()
  token!: string;
}

function argument(
  type: ArgumentMetadata['type'],
  data?: string,
  metatype?: ArgumentMetadata['metatype'],
): ArgumentMetadata {
  return { type, data, metatype };
}

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

function nested(depth: number, leaf: unknown): unknown {
  let value = leaf;
  for (let level = 0; level < depth; level += 1) value = [value];
  return value;
}

describe('StorableTextPipe', () => {
  it.each(['param', 'query', 'body'] as const)(
    'returns clean text from %s untouched',
    (type) => {
      const value = { name: 'Zoe \u{1F600}\t\u0001', tags: ['a', 'b'] };

      expect(pipe.transform(value, argument(type))).toBe(value);
    },
  );

  it('does not look at a custom argument', () => {
    const value = { note: `a${NUL}b` };

    expect(pipe.transform(value, argument('custom'))).toBe(value);
  });

  it('answers 404 for a path value that holds a NUL', () => {
    const error = thrownBy(() =>
      pipe.transform(`a${NUL}b`, argument('param', 'id')),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe('Resource not found');
  });

  it('answers 404 for a NUL inside a path object', () => {
    const error = thrownBy(() =>
      pipe.transform({ id: `a${NUL}` }, argument('param')),
    );

    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('answers 400 naming a single query value', () => {
    const error = thrownBy(() =>
      pipe.transform(NUL, argument('query', 'version')),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      'version must not contain a NUL character',
    );
  });

  it('answers 400 naming the field of a body object', () => {
    const error = thrownBy(() =>
      pipe.transform({ note: `a${NUL}b` }, argument('body')),
    );

    expect((error as BadRequestException).message).toBe(
      'note must not contain a NUL character',
    );
  });

  it('names the element of a list and the property of a nested object', () => {
    const error = thrownBy(() =>
      pipe.transform(
        { owner: { aliases: ['fine', `bad${NUL}`] } },
        argument('body'),
      ),
    );

    expect((error as BadRequestException).message).toBe(
      'owner.aliases[1] must not contain a NUL character',
    );
  });

  it('names a repeated query value by its position', () => {
    const error = thrownBy(() =>
      pipe.transform({ version: ['1.0', NUL] }, argument('query')),
    );

    expect((error as BadRequestException).message).toBe(
      'version[1] must not contain a NUL character',
    );
  });

  it('names the source when a bare body is the text', () => {
    const error = thrownBy(() => pipe.transform(NUL, argument('body')));

    expect((error as BadRequestException).message).toBe(
      'body must not contain a NUL character',
    );
  });

  it('reports the shallowest value first', () => {
    const error = thrownBy(() =>
      pipe.transform({ deep: { deeper: NUL }, shallow: NUL }, argument('body')),
    );

    expect((error as BadRequestException).message).toBe(
      'shallow must not contain a NUL character',
    );
  });

  it.each([
    ['body', 'a top level key', { [`x${NUL}`]: NUL }],
    ['body', 'a nested key', { owner: { [`a${NUL}`]: NUL } }],
    ['body', 'a key with a lone surrogate', { 'a\ud83d': NUL }],
    ['query', 'a query key', { [`v${NUL}`]: [NUL] }],
  ] as const)(
    'names the %s rather than echo %s that breaks a rule',
    (source, _name, value) => {
      const error = thrownBy(() => pipe.transform(value, argument(source)));

      expect((error as BadRequestException).message).toBe(
        `${source} must not contain a NUL character`,
      );
    },
  );

  it('leaves property names to the validation pipe', () => {
    const value = { [`odd${NUL}`]: 'text' };

    expect(pipe.transform(value, argument('body'))).toBe(value);
  });

  it('passes numbers, booleans and null through', () => {
    const value = { count: 3, active: false, note: null };

    expect(pipe.transform(value, argument('body'))).toBe(value);
  });

  it('does not walk a buffer or a date', () => {
    const value = { raw: Buffer.from(`a${NUL}b`), at: new Date(0) };

    expect(pipe.transform(value, argument('body'))).toBe(value);
  });

  it('walks an object that has no prototype', () => {
    const value = Object.assign(Object.create(null) as object, {
      version: NUL,
    });

    expect(
      thrownBy(() => pipe.transform(value, argument('query'))),
    ).toBeInstanceOf(BadRequestException);
  });

  it('refuses a very deep body without exhausting the stack', () => {
    const error = thrownBy(() =>
      pipe.transform(nested(DEEPEST, 'text'), argument('body')),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(`body ${TOO_DEEP}`);
  });

  it('accepts a body nested exactly to the limit', () => {
    const value = nested(DEEPEST_ALLOWED, 'text');

    expect(pipe.transform(value, argument('body'))).toBe(value);
  });

  it('refuses a body one level past the limit, even when it is empty', () => {
    const error = thrownBy(() =>
      pipe.transform(nested(DEEPEST_ALLOWED + 1, []), argument('body')),
    );

    expect((error as BadRequestException).message).toBe(`body ${TOO_DEEP}`);
  });

  it('counts the object that holds a field as a level', () => {
    const error = thrownBy(() =>
      pipe.transform(
        { version: nested(DEEPEST_ALLOWED, '1') },
        argument('query', 'version'),
      ),
    );

    expect((error as BadRequestException).message).toBe(`query ${TOO_DEEP}`);
  });

  it('reports a NUL above the limit before the depth', () => {
    const error = thrownBy(() =>
      pipe.transform(
        { note: NUL, deep: nested(DEEPEST, 'text') },
        argument('body'),
      ),
    );

    expect((error as BadRequestException).message).toBe(
      'note must not contain a NUL character',
    );
  });

  it('limits the depth of a field marked hashed only', () => {
    const error = thrownBy(() =>
      pipe.transform(
        { password: nested(DEEPEST, 'text'), name: 'Zoe' },
        argument('body', undefined, Credentials),
      ),
    );

    expect((error as BadRequestException).message).toBe(`body ${TOO_DEEP}`);
  });

  it('leaves a field marked hashed only unscanned', () => {
    const value = { password: `pass${NUL}word`, name: 'Zoe' };

    expect(
      pipe.transform(value, argument('body', undefined, Credentials)),
    ).toBe(value);
  });

  it('still scans the other fields of the same object', () => {
    const error = thrownBy(() =>
      pipe.transform(
        { password: `pass${NUL}word`, name: `Zoe${NUL}` },
        argument('body', undefined, Credentials),
      ),
    );

    expect((error as BadRequestException).message).toBe(
      'name must not contain a NUL character',
    );
  });

  it('honours the fields a parent class marked', () => {
    const value = { password: NUL, token: NUL, name: 'Zoe' };

    expect(
      pipe.transform(value, argument('body', undefined, ExtendedCredentials)),
    ).toBe(value);
  });

  it('does not let a subclass mark leak into its parent', () => {
    const error = thrownBy(() =>
      pipe.transform({ token: NUL }, argument('body', undefined, Credentials)),
    );

    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('scans a nested field that shares the name of a marked one', () => {
    const error = thrownBy(() =>
      pipe.transform(
        { owner: { password: NUL } },
        argument('body', undefined, Credentials),
      ),
    );

    expect((error as BadRequestException).message).toBe(
      'owner.password must not contain a NUL character',
    );
  });

  it('scans everything when the argument has no class', () => {
    const error = thrownBy(() =>
      pipe.transform({ password: NUL }, argument('body', undefined, Object)),
    );

    expect(error).toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['a lone high surrogate', 'a\ud83d'],
    ['a lone low surrogate', 'a\ude00b'],
    ['surrogates in the wrong order', '\ude00\ud83d'],
  ])('answers 400 for %s', (_name, text) => {
    const error = thrownBy(() =>
      pipe.transform({ note: text }, argument('body')),
    );

    expect((error as BadRequestException).message).toBe(
      'note must be well formed Unicode text',
    );
  });

  it('accepts a surrogate pair', () => {
    const value = { note: 'pair \ud83d\ude00' };

    expect(pipe.transform(value, argument('body'))).toBe(value);
  });

  it('names the NUL when a value holds both problems', () => {
    const error = thrownBy(() =>
      pipe.transform({ note: `\ud83d${NUL}` }, argument('body')),
    );

    expect((error as BadRequestException).message).toBe(
      'note must not contain a NUL character',
    );
  });

  it('leaves a hashed only field with a lone surrogate unscanned', () => {
    const value = { password: 'a\ud83d', name: 'Zoe' };

    expect(
      pipe.transform(value, argument('body', undefined, Credentials)),
    ).toBe(value);
  });
});
