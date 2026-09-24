const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

function databaseNameOf(url: string | undefined): string | undefined {
  if (!url || !URL.canParse(url)) return undefined;
  const { protocol, pathname } = new URL(url);
  return POSTGRES_PROTOCOLS.has(protocol) ? pathname.slice(1) : undefined;
}

export function assertTestDatabase(url: string | undefined): void {
  const databaseName = databaseNameOf(url);
  if (!databaseName?.endsWith('_test')) {
    throw new Error(
      `These specs migrate and truncate their database, so DATABASE_URL must name a postgres database ending in _test, got ${databaseName ? `"${databaseName}"` : 'none'}.`,
    );
  }
}
