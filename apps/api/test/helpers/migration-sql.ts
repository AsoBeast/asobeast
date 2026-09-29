import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');

export const migrationSql = (suffix: string): string => {
  const folder = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith(`_${suffix}`),
  );
  if (!folder) throw new Error(`no ${suffix} migration`);
  return readFileSync(join(MIGRATIONS, folder, 'migration.sql'), 'utf8');
};
