export interface FeedCursor {
  createdAt: Date;
  id: string;
}

const SEPARATOR = '|';
const MAX_CURSOR_LENGTH = 200;
const ROW_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function encodeCursor(row: FeedCursor): string {
  return Buffer.from(
    `${row.createdAt.toISOString()}${SEPARATOR}${row.id}`,
  ).toString('base64url');
}

function readInstant(value: string): Date | null {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString() === value ? instant : null;
}

export function decodeCursor(value: string): FeedCursor | null {
  if (value.length === 0 || value.length > MAX_CURSOR_LENGTH) return null;
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  const split = decoded.indexOf(SEPARATOR);
  if (split < 0) return null;
  const createdAt = readInstant(decoded.slice(0, split));
  const id = decoded.slice(split + 1);
  if (!createdAt || !ROW_ID.test(id)) return null;
  return { createdAt, id };
}
