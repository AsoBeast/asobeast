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

const MAX_NESTING_DEPTH = 64;

interface Pending {
  path: string;
  value: unknown;
  depth: number;
  stored: boolean;
}

interface Child {
  path: string;
  value: unknown;
  key?: string;
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

function childrenOf(path: string, value: unknown): Child[] | undefined {
  if (Array.isArray(value)) {
    return value.map((item: unknown, index) => ({
      path: `${path}[${index}]`,
      value: item,
    }));
  }
  if (!isPlainObject(value)) return undefined;
  return Object.entries(value).map(([key, item]) => ({
    path: childPath(path, key),
    value: item,
    key,
  }));
}

function firstViolation(
  root: unknown,
  rootPath: string,
  hashedOnly: ReadonlySet<string>,
): Violation | undefined {
  const pending: Pending[] = [
    { path: rootPath, value: root, depth: 0, stored: true },
  ];
  for (let next = 0; next < pending.length; next += 1) {
    const { path, value, depth, stored } = pending[next];
    if (typeof value === 'string') {
      const requirement = stored ? requirementBrokenBy(value) : undefined;
      if (requirement) return { path, requirement };
      continue;
    }
    const children = childrenOf(path, value);
    if (!children) continue;
    if (depth >= MAX_NESTING_DEPTH) {
      return {
        path: '',
        requirement: `must not be nested more than ${MAX_NESTING_DEPTH} levels deep`,
      };
    }
    for (const child of children) {
      const hashed =
        depth === 0 && child.key !== undefined && hashedOnly.has(child.key);
      pending.push({
        path: child.path,
        value: child.value,
        depth: depth + 1,
        stored: stored && !hashed,
      });
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
    const violation = firstViolation(
      value,
      data ?? '',
      hashedOnlyFieldsOf(metatype),
    );
    if (!violation) return value;
    if (type === 'param') throw new NotFoundException('Resource not found');
    throw new BadRequestException(
      `${nameOf(violation.path, type)} ${violation.requirement}`,
    );
  }
}
