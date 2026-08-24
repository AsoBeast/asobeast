const MAX_ROWS_INSPECTED = 500;
const MAX_RELATION_DEPTH = 2;
const EMPTY: string[] = [];

export function foreignWorkspaces(
  result: unknown,
  workspaceId: string,
): string[] {
  const foreign = new Set<string>();

  if (!Array.isArray(result)) {
    collectForeign(result, workspaceId, 0, foreign);
    return foreign.size === 0 ? EMPTY : [...foreign];
  }

  const inspected = Math.min(result.length, MAX_ROWS_INSPECTED);
  for (let index = 0; index < inspected; index += 1) {
    collectForeign(result[index], workspaceId, 0, foreign);
  }
  return foreign.size === 0 ? EMPTY : [...foreign];
}

function collectForeign(
  row: unknown,
  workspaceId: string,
  depth: number,
  foreign: Set<string>,
): void {
  if (row === null || typeof row !== 'object') return;

  const owner = (row as { workspaceId?: unknown }).workspaceId;
  if (typeof owner === 'string' && owner !== workspaceId) foreign.add(owner);
  if (depth >= MAX_RELATION_DEPTH) return;

  for (const value of Object.values(row)) {
    if (Array.isArray(value)) {
      const inspected = Math.min(value.length, MAX_ROWS_INSPECTED);
      for (let index = 0; index < inspected; index += 1) {
        collectForeign(value[index], workspaceId, depth + 1, foreign);
      }
      continue;
    }
    if (value !== null && typeof value === 'object') {
      collectForeign(value, workspaceId, depth + 1, foreign);
    }
  }
}
