const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const HOST_OVERRIDES = ['hostaddr', 'service'];
const REFUSAL =
  'These specs migrate and truncate their database, so DATABASE_URL must';

function quoted(value: string | undefined): string {
  return value ? `"${value}"` : 'none';
}

function parsePostgresUrl(url: string | undefined): URL | undefined {
  if (!url || !URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  return POSTGRES_PROTOCOLS.has(parsed.protocol) ? parsed : undefined;
}

function remoteHostOf({ hostname, searchParams }: URL): string | undefined {
  const override = HOST_OVERRIDES.find((key) => searchParams.has(key));
  if (override) return `${override}=${searchParams.get(override)}`;
  const hosts = searchParams.has('host')
    ? searchParams.getAll('host')
    : [hostname];
  return hosts.find(
    (host) => !LOOPBACK_HOSTS.has(host) && !host.startsWith('/'),
  );
}

export function assertTestDatabase(url: string | undefined): void {
  const parsed = parsePostgresUrl(url);
  const databaseName = parsed?.pathname.slice(1);
  if (!parsed || !databaseName?.endsWith('_test')) {
    throw new Error(
      `${REFUSAL} name a postgres database ending in _test, got ${quoted(databaseName)}.`,
    );
  }
  const remoteHost = remoteHostOf(parsed);
  if (remoteHost !== undefined) {
    throw new Error(
      `${REFUSAL} reach it through a loopback host or unix socket, got ${quoted(remoteHost)}.`,
    );
  }
}
