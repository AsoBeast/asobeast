import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');

export const migrationFolders = (): string[] =>
  readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

export const migrationFolder = (suffix: string): string => {
  const folder = migrationFolders().find((name) => name.endsWith(`_${suffix}`));
  if (!folder) throw new Error(`no ${suffix} migration`);
  return folder;
};

export const readMigration = (folder: string): string =>
  readFileSync(join(MIGRATIONS, folder, 'migration.sql'), 'utf8');

export const migrationSql = (suffix: string): string =>
  readMigration(migrationFolder(suffix));
