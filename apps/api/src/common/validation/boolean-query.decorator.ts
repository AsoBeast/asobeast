import { Transform } from 'class-transformer';

const BOOLEAN_WORDS = new Map<unknown, boolean>([
  ['true', true],
  ['false', false],
]);

export const BooleanQuery = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    BOOLEAN_WORDS.has(value) ? BOOLEAN_WORDS.get(value) : value,
  );
