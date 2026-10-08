import { Client } from 'pg';
import { migrationFolders, readMigration } from './helpers/migration-sql';

describe('the migration history', () => {
  const testUrl = new URL(process.env.DATABASE_URL ?? '');
  const shadowName = `${testUrl.pathname.slice(1)}_shadow`;
  const shadowUrl = new URL(testUrl);
  shadowUrl.pathname = `/${shadowName}`;
  const admin = new Client({ connectionString: testUrl.toString() });
  const shadow = new Client({ connectionString: shadowUrl.toString() });
  const dropShadow = () =>
    admin.query(
      `DROP DATABASE IF EXISTS ${admin.escapeIdentifier(shadowName)} WITH (FORCE)`,
    );

  beforeAll(async () => {
    await admin.connect();
    await dropShadow();
    await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(shadowName)}`);
    await shadow.connect();
  });

  afterAll(async () => {
    await shadow.end();
    await dropShadow();
    await admin.end();
  });

  it.each(migrationFolders())(
    'replays %s into a shadow database that has no migrations table',
    async (folder) => {
      await shadow.query(readMigration(folder));
    },
  );
});
