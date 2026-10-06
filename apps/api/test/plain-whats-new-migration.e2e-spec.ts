import { execSync } from 'child_process';
import { join } from 'path';
import { releaseNotesText } from '@asobeast/shared';
import { PrismaClient, Store } from '@prisma/client';
import { Client } from 'pg';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { migrationSql } from './helpers/migration-sql';
import { testDb } from './helpers/test-db';

const LEGACY = new Date('2026-09-01T00:00:00Z');

const LEGACY_NOTES = [
  'v4.6862<br>- New stickers<br/>- New memes:<BR />✓ Old',
  'New<br class="note">features<br data-x=1/>here',
  '<brand>Fixes</brand>',
  'One\r\nTwo\rThree',
  '<b>Fixes</b> for <a href="x">links</a>',
  '<<b>b>Bold</b>',
  '<<script>script>alert(1)<</script>/script>',
  'We <3 you, 2 < 3 > 1',
  'Fixes &amp; speed&#33; &quot;Pro&#x22; &LT;3&nbsp;',
  '&copy; &#99999999; &#xD800; &#0; &#x110000;',
  'Type &lt;br&gt; to wrap',
  '&amp;lt; stays escaped next to &lt;',
  'Leading zeros &#0000065; and &#x00000042;',
  '  One <br><br>  <br>Two<br>',
  'Fixes<br>- New stickers<b…',
  'Fixes<br>- Faster sync</b',
  'Fixes<br>- Faster sync<b…x',
  'We <3 you…',
  ' Café <br>﻿Tea　',
  'Bug fixes\n- Faster sync\n- New widgets',
];

describe('the plain play whats new migration', () => {
  const sql = migrationSql('plain_play_whats_new_events');
  let prisma: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const seedApp = (store: Store) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: `${store}-1`,
        country: 'us',
        name: store,
      },
    });

  const runMigration = async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  };

  const whatsNew = (
    appId: string,
    before: string | null,
    after: string | null,
    capturedAt = LEGACY,
  ) =>
    prisma.changeEvent.create({
      data: { appId, field: 'whatsNew', before, after, capturedAt },
      select: { id: true },
    });

  const valuesOf = async (id: string) =>
    prisma.changeEvent.findUnique({
      where: { id },
      select: { before: true, after: true },
    });

  it.each(LEGACY_NOTES)(
    'reads the stored google play markup %j the way the app reads it',
    async (notes) => {
      const play = await seedApp(Store.GOOGLE_PLAY);
      const event = await whatsNew(play.id, 'Earlier notes', notes);

      await runMigration();

      expect(await valuesOf(event.id)).toEqual({
        before: 'Earlier notes',
        after: releaseNotesText(notes) || null,
      });
    },
  );

  it('converts both sides of a google play event', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    const event = await whatsNew(
      play.id,
      'v2.7<br>- Calmer sounds',
      'v2.8<br>- New stickers<br/>- Faster sync &amp; backup<br>',
    );

    await runMigration();

    expect(await valuesOf(event.id)).toEqual({
      before: 'v2.7\n- Calmer sounds',
      after: 'v2.8\n- New stickers\n- Faster sync & backup',
    });
  });

  it('drops a google play event whose notes differed only in markup', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    await whatsNew(play.id, 'Fixes.', 'Fixes.<br>');
    await whatsNew(play.id, null, '<br> <br/>');
    const kept = await whatsNew(play.id, '<br>', 'Fixes.');

    await runMigration();

    const events = await prisma.changeEvent.findMany({
      where: { appId: play.id },
      select: { id: true, before: true, after: true },
    });
    expect(events).toEqual([{ id: kept.id, before: null, after: 'Fixes.' }]);
  });

  it('leaves events recorded after the release that stores plain text', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    const plain = await whatsNew(
      play.id,
      'Type <Username> to mention',
      'Fixes &amp; more\n- Faster sync',
      new Date(),
    );

    await runMigration();

    expect(await valuesOf(plain.id)).toEqual({
      before: 'Type <Username> to mention',
      after: 'Fixes &amp; more\n- Faster sync',
    });
  });

  it('leaves app store notes and other google play fields alone', async () => {
    const play = await seedApp(Store.GOOGLE_PLAY);
    const apple = await seedApp(Store.APP_STORE);
    const appleNotes = await whatsNew(apple.id, 'A &amp; B', 'C<br>D');
    const title = await prisma.changeEvent.create({
      data: {
        appId: play.id,
        field: 'title',
        before: 'Old &amp; title',
        after: 'New<br>title',
        capturedAt: LEGACY,
      },
      select: { id: true },
    });

    await runMigration();

    expect(await valuesOf(appleNotes.id)).toEqual({
      before: 'A &amp; B',
      after: 'C<br>D',
    });
    expect(await valuesOf(title.id)).toEqual({
      before: 'Old &amp; title',
      after: 'New<br>title',
    });
  });
});
