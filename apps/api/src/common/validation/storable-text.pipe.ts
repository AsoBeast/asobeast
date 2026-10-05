import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { hashedOnlyFieldsOf } from './hashed-only.decorator';

const GUARDED_SOURCES: readonly ArgumentMetadata['type'][] = [
  'param',
  'query',
  'body',
];

const UNPAIRED_SURROGATE = /\p{Surrogate}/u;

const TEXT_RULES = [
  {
    refuses: (text: string) => text.includes('\u0000'),
    requirement: 'must not contain a NUL character',
  },
  {
    refuses: (text: string) => UNPAIRED_SURROGATE.test(text),
    requirement: 'must be well formed Unicode text',
  },
] as const;

interface Pending {
  path: string;
  value: unknown;
}

interface Violation {
  path: string;
  requirement: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function childPath(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}

function requirementBrokenBy(text: string): string | undefined {
  return TEXT_RULES.find((rule) => rule.refuses(text))?.requirement;
}

function nameOf(path: string, source: string): string {
  return path === '' || requirementBrokenBy(path) ? source : path;
}

function withoutFields(value: unknown, skipped: ReadonlySet<string>): unknown {
  if (skipped.size === 0 || !isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !skipped.has(key)),
  );
}

function firstViolation(
  root: unknown,
  rootPath: string,
): Violation | undefined {
  const pending: Pending[] = [{ path: rootPath, value: root }];
  for (let next = 0; next < pending.length; next += 1) {
    const { path, value } = pending[next];
    if (typeof value === 'string') {
      const requirement = requirementBrokenBy(value);
      if (requirement) return { path, requirement };
    } else if (Array.isArray(value)) {
      value.forEach((item: unknown, index) =>
        pending.push({ path: `${path}[${index}]`, value: item }),
      );
    } else if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        pending.push({ path: childPath(path, key), value: item });
      }
    }
  }
  return undefined;
}

@Injectable()
export class StorableTextPipe implements PipeTransform {
  transform(
    value: unknown,
    { type, data, metatype }: ArgumentMetadata,
  ): unknown {
    if (!GUARDED_SOURCES.includes(type)) return value;
    const scanned = withoutFields(value, hashedOnlyFieldsOf(metatype));
    const violation = firstViolation(scanned, data ?? '');
    if (!violation) return value;
    if (type === 'param') throw new NotFoundException('Resource not found');
    throw new BadRequestException(
      `${nameOf(violation.path, type)} ${violation.requirement}`,
    );
  }
}
