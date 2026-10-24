import {
  API_TOKEN_PREFIX,
  SESSION_COOKIE,
  redactUrlCredentials,
} from '@asobeast/shared';

export const REDACTED = '[redacted]';

export const REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.authorization',
  '*.cookie',
  '*.password',
  '*.secret',
  '*.token',
  '*.apiKey',
  '*.privateKey',
];

const SECRET_KEY =
  /^(?:authorization|cookie|set-cookie|pass|passwd|pwd|password|passphrase|(?:client[-_]?)?secret|(?:(?:access|refresh|id|auth)[-_]?)?token|api[-_]?key|private[-_]?key|credentials?)$/i;

const BRACKETS = /[[\]]+/;
const QUERY_PARAMETER_NAME = /([?&;])([^?&;=#\s"']+)=/g;
const QUERY_VALUE_END = /[&#\s]/g;

function isSecretKey(name: string): boolean {
  return name.split(BRACKETS).some((segment) => SECRET_KEY.test(segment));
}

function decodedName(name: string): string {
  try {
    return decodeURIComponent(name.replaceAll('+', ' '));
  } catch {
    return name;
  }
}

function redactQueryCredentials(text: string): string {
  let redacted = '';
  let copiedUpTo = 0;
  for (const match of text.matchAll(QUERY_PARAMETER_NAME)) {
    if (match.index < copiedUpTo || !isSecretKey(decodedName(match[2]))) {
      continue;
    }
    const valueStart = match.index + match[0].length;
    QUERY_VALUE_END.lastIndex = valueStart;
    const valueEnd = QUERY_VALUE_END.exec(text)?.index ?? text.length;
    redacted += text.slice(copiedUpTo, valueStart) + REDACTED;
    copiedUpTo = valueEnd;
  }
  return redacted + text.slice(copiedUpTo);
}

const SECRET_SHAPES: [RegExp, string][] = [
  [new RegExp(`${API_TOKEN_PREFIX}[A-Za-z0-9_-]{8,}`, 'g'), REDACTED],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, REDACTED],
  [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}/g, REDACTED],
  [/\bwhsec_[A-Za-z0-9]{8,}/g, REDACTED],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    REDACTED,
  ],
  [/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, REDACTED],
  [/\bya29\.[\w-]{10,}/g, REDACTED],
  [
    new RegExp(`${SESSION_COOKIE}=[^;\\s"']+`, 'g'),
    `${SESSION_COOKIE}=${REDACTED}`,
  ],
];

const MAX_DEPTH = 8;
const MIN_LITERAL_LENGTH = 8;

export const TRUNCATED = '[truncated]';

export const CIRCULAR = '[circular]';

export function scrubSecrets<T>(value: T, literals: readonly string[]): T {
  return walk(value, literals, 0, new WeakSet()) as T;
}

export function scrubText(text: string, literals: readonly string[]): string {
  let scrubbed = text;
  for (const literal of literals) {
    if (literal.length >= MIN_LITERAL_LENGTH) {
      scrubbed = scrubbed.split(literal).join(REDACTED);
    }
  }
  for (const [shape, replacement] of SECRET_SHAPES) {
    scrubbed = scrubbed.replace(shape, replacement);
  }
  return redactQueryCredentials(redactUrlCredentials(scrubbed, REDACTED));
}

function scrubError(
  error: Error,
  literals: readonly string[],
  depth: number,
  seen: WeakSet<object>,
): Error {
  const scrubbed = new Error(scrubText(error.message, literals), {
    cause: walk(error.cause, literals, depth + 1, seen),
  });
  scrubbed.name = error.name;
  if (error.stack) scrubbed.stack = scrubText(error.stack, literals);
  const own = walk({ ...error }, literals, depth + 1, seen);
  return own !== null && typeof own === 'object'
    ? Object.assign(scrubbed, own)
    : scrubbed;
}

function walk(
  value: unknown,
  literals: readonly string[],
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'string') return scrubText(value, literals);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return TRUNCATED;
  if (seen.has(value)) return CIRCULAR;

  seen.add(value);
  try {
    if (value instanceof Error) return scrubError(value, literals, depth, seen);
    if (Array.isArray(value)) {
      return value.map((entry) => walk(entry, literals, depth + 1, seen));
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSecretKey(key) ? REDACTED : walk(entry, literals, depth + 1, seen),
      ]),
    );
  } finally {
    seen.delete(value);
  }
}
