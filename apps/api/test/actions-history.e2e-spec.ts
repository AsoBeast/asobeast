import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS = join(__dirname, '..', 'prisma', 'migrations');

const migrationSql = (suffix: string): string => {
  const folder = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith(`_${suffix}`),
  );
  if (!folder) throw new Error(`no ${suffix} migration`);
  return readFileSync(join(MIGRATIONS, folder, 'migration.sql'), 'utf8');
};

describe('action history (e2e)', () => {
  describe('the action event migration', () => {
    const sql = migrationSql('add_action_events');

    it('backfills an opened, a closed and a resolved event', () => {
      expect(sql.match(/INSERT INTO "ActionEvent"/g)).toHaveLength(3);
      expect(sql).toContain("'opened', 'system', 'OPEN'");
      expect(sql).toContain("WHERE i.\"status\" IN ('DONE', 'DISMISSED')");
      expect(sql).toContain("'resolved', 'system', 'RESOLVED'");
    });

    it('protects the table with the tenant isolation policy', () => {
      expect(sql).toContain(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON "ActionEvent" TO asobeast_app;',
      );
      expect(sql).toContain(
        'ALTER TABLE "ActionEvent" FORCE ROW LEVEL SECURITY;',
      );
      expect(sql).toContain('CREATE POLICY tenant_isolation ON "ActionEvent"');
    });

    it('backfills before row level security is enforced', () => {
      expect(sql.lastIndexOf('INSERT INTO "ActionEvent"')).toBeLessThan(
        sql.indexOf('ENABLE ROW LEVEL SECURITY'),
      );
    });
  });
});
