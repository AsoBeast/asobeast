import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { migrationFolders, readMigration } from './helpers/migration-sql';

describe('the migration history', () => {
  const testUrl = new URL(process.env.DATABASE_URL ?? '');
  const shadowName = `${testUrl.pathname.slice(1)}_shadow_${randomBytes(8).toString('hex')}`;
  const shadowUrl = new URL(testUrl);
  shadowUrl.pathname = `/${shadowName}`;
  const admin = new Client({ connectionString: testUrl.toString() });
  const shadow = new Client({ connectionString: shadowUrl.toString() });
  let created = false;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(shadowName)}`);
    created = true;
    await shadow.connect();
  });

  afterAll(async () => {
    await shadow.end();
    if (created) {
      await admin.query(
        `DROP DATABASE ${admin.escapeIdentifier(shadowName)} WITH (FORCE)`,
      );
    }
    await admin.end();
  });

  it.each(migrationFolders())(
    'replays %s into a shadow database that has no migrations table',
    async (folder) => {
      await shadow.query(readMigration(folder));
    },
  );
});
