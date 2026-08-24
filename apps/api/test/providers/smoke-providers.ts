import { appStoreLib } from '../../src/store-providers/app-store.lib';
import { AppStoreProvider } from '../../src/store-providers/app-store.provider';
import { googlePlayLib } from '../../src/store-providers/google-play.lib';
import { GooglePlayProvider } from '../../src/store-providers/google-play.provider';
import { NormalizedApp, SearchItem } from '../../src/store-providers/types';

const COUNTRY = process.env.SMOKE_COUNTRY ?? 'us';
const APP_STORE_ID = process.env.SMOKE_APP_STORE_ID ?? '284882215';
const GOOGLE_PLAY_ID =
  process.env.SMOKE_GOOGLE_PLAY_ID ?? 'com.facebook.katana';
const TERM = process.env.SMOKE_TERM ?? 'photo editor';

interface Check {
  name: string;
  run: () => Promise<string>;
}

function assertApp(app: NormalizedApp): string {
  const missing = (['storeAppId', 'title', 'description'] as const).filter(
    (field) => !app[field],
  );
  if (missing.length > 0) {
    throw new Error(`parsed app is missing ${missing.join(', ')}`);
  }
  if (typeof app.storeAppId !== 'string') {
    throw new Error('storeAppId is not a string');
  }
  return `${app.storeAppId} "${app.title}" rating ${app.ratingAvg ?? 'none'}`;
}

function assertSearch(results: SearchItem[]): string {
  if (results.length === 0) {
    throw new Error('search returned no results');
  }
  const broken = results.find((item) => !item.storeAppId || !item.title);
  if (broken) {
    throw new Error(`a search result is missing storeAppId or title`);
  }
  return `${results.length} results, first "${results[0].title}"`;
}

async function main(): Promise<void> {
  if (process.env.SMOKE_PROVIDERS !== '1') {
    console.log(
      'Skipped. This performs live store requests, so it is opt in: set SMOKE_PROVIDERS=1 to run it.',
    );
    return;
  }

  const appStore = new AppStoreProvider(appStoreLib);
  const googlePlay = new GooglePlayProvider(googlePlayLib);

  const checks: Check[] = [
    {
      name: 'APP_STORE getApp',
      run: async () => assertApp(await appStore.getApp(APP_STORE_ID, COUNTRY)),
    },
    {
      name: 'APP_STORE search',
      run: async () => assertSearch(await appStore.search(TERM, COUNTRY, 5)),
    },
    {
      name: 'GOOGLE_PLAY getApp',
      run: async () =>
        assertApp(await googlePlay.getApp(GOOGLE_PLAY_ID, COUNTRY)),
    },
    {
      name: 'GOOGLE_PLAY search',
      run: async () => assertSearch(await googlePlay.search(TERM, COUNTRY, 5)),
    },
  ];

  const failures: string[] = [];
  for (const check of checks) {
    try {
      console.log(`ok   ${check.name}: ${await check.run()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${check.name}: ${message}`);
      failures.push(check.name);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} of ${checks.length} parser checks failed: ${failures.join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${checks.length} parser checks passed.`);
}

void main();
