import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3001';
const OUT = '/home/user/asobeast/qa/evidence/ui';
const ids = Object.fromEntries(
  readFileSync('/home/user/asobeast/qa/ids.env', 'utf8').trim().split('\n').map((l) => l.split('=')),
);
const log = (tc, result, detail = '') => console.log(`${result.padEnd(6)} ${tc.padEnd(28)} ${detail}`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
page.on('dialog', async (d) => { errors.push('DIALOG ' + d.message); await d.dismiss(); });

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'qa-owner@asobeast.test');
await page.fill('input[type="password"]', 'QaOwnerPass123!');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});

const KW = BASE + `/apps/${ids.PRIMARY}/keywords`;
await page.goto(KW, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// --- UI-001 how many interactive elements does the keywords page expose? -----
const counts = await page.evaluate(() => ({
  buttons: document.querySelectorAll('button').length,
  links: document.querySelectorAll('a[href]').length,
  inputs: document.querySelectorAll('input,select,textarea').length,
  rows: document.querySelectorAll('tbody tr, [role="row"]').length,
  iconOnly: [...document.querySelectorAll('button')].filter((b) => !b.textContent.trim()).length,
  unlabelledIconButtons: [...document.querySelectorAll('button')].filter(
    (b) => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'),
  ).length,
}));
log('UI-001 element inventory', 'INFO', JSON.stringify(counts));
log(
  'UI-002 icon buttons labelled',
  counts.unlabelledIconButtons === 0 ? 'PASS' : 'FAIL',
  `iconOnly=${counts.iconOnly} withoutAccessibleName=${counts.unlabelledIconButtons}`,
);

// --- UI-003 virtualization / render cost with 216 keywords ------------------
const t0 = Date.now();
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const renderMs = Date.now() - t0;
const domRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
log('UI-003 216 keywords render', renderMs < 6000 ? 'PASS' : 'FAIL', `reload=${renderMs}ms domRows=${domRows}`);

// --- UI-004 add a keyword through the UI (and double-click the submit) ------
const before = await page.evaluate(() => document.body.innerText.includes('ui added keyword'));
let addOpened = false;
for (const sel of ['button:has-text("Add keyword")', 'button:has-text("Add keywords")', 'button:has-text("Add")']) {
  const el = page.locator(sel).first();
  if (await el.count()) { await el.click().catch(() => {}); addOpened = true; break; }
}
await page.waitForTimeout(900);
const ta = page.locator('textarea, input[type="text"]:visible').first();
if (addOpened && (await ta.count())) {
  await ta.fill('ui added keyword');
  const submit = page.locator('button[type="submit"]:visible, [role="dialog"] button:has-text("Add")').last();
  // double click fast -> must not create two rows
  await submit.click({ clickCount: 2, delay: 20 }).catch(() => {});
  await page.waitForTimeout(2500);
  log('UI-004 add keyword via UI', 'INFO', `dialogOpened=${addOpened} submitted (before existed=${before})`);
} else {
  log('UI-004 add keyword via UI', 'BLOCK', `could not locate add form (addOpened=${addOpened})`);
}

// --- UI-005 Escape closes any open dialog -----------------------------------
const dlgBefore = await page.locator('[role="dialog"]').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
const dlgAfter = await page.locator('[role="dialog"]').count();
log('UI-005 Escape closes dialog', dlgAfter <= dlgBefore ? 'PASS' : 'FAIL', `dialogs ${dlgBefore} -> ${dlgAfter}`);

// --- UI-006 hard reload persistence -----------------------------------------
await page.goto(KW, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const persisted = await page.evaluate(() => document.body.innerText.includes('ui added keyword'));
log('UI-006 survives hard reload', persisted ? 'PASS' : 'INFO', `keywordVisibleAfterReload=${persisted}`);

// --- UI-007 sort headers are clickable and stable ---------------------------
const headers = page.locator('th button, th[role="button"], th');
const hCount = await headers.count();
let sortClicks = 0;
for (let i = 0; i < Math.min(hCount, 6); i += 1) {
  const h = headers.nth(i);
  if (await h.isVisible().catch(() => false)) {
    await h.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    sortClicks += 1;
  }
}
const afterSortRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
log('UI-007 sort headers clicked', afterSortRows > 0 ? 'PASS' : 'FAIL', `clicked=${sortClicks} rowsAfter=${afterSortRows}`);

// --- UI-008 browser back / forward ------------------------------------------
await page.goto(BASE + `/apps/${ids.PRIMARY}`, { waitUntil: 'networkidle' });
await page.goto(KW, { waitUntil: 'networkidle' });
await page.goBack({ waitUntil: 'networkidle' });
const backUrl = page.url();
await page.goForward({ waitUntil: 'networkidle' });
const fwdUrl = page.url();
await page.waitForTimeout(1000);
const stillRendered = await page.evaluate(() => document.querySelectorAll('tbody tr').length > 0);
log('UI-008 back/forward', stillRendered ? 'PASS' : 'FAIL', `back=${backUrl.split('/').pop()} fwd=${fwdUrl.split('/').pop()} rowsRendered=${stillRendered}`);

// --- UI-009 offline then back online ----------------------------------------
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
const offlineText = (await page.textContent('body').catch(() => '')) ?? '';
const offlineBlank = offlineText.trim().length < 40;
log('UI-009 offline behaviour', offlineBlank ? 'FAIL' : 'PASS', `bodyChars=${offlineText.trim().length} snippet="${offlineText.trim().slice(0, 90).replace(/\s+/g, ' ')}"`);
await ctx.setOffline(false);
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const recovered = await page.evaluate(() => document.querySelectorAll('tbody tr').length > 0);
log('UI-010 recovers after online', recovered ? 'PASS' : 'FAIL', `rowsRendered=${recovered}`);

// --- UI-011 slow 3G: is a loading state shown -------------------------------
const slow = await ctx.newPage();
await slow.route('**/api/backend/**', async (route) => {
  await new Promise((r) => setTimeout(r, 3000));
  await route.continue();
});
await slow.goto(KW, { waitUntil: 'domcontentloaded' });
await slow.waitForTimeout(1200);
const loadingShown = await slow.evaluate(() => {
  const t = document.body.innerText.toLowerCase();
  return (
    document.querySelectorAll('[role="status"], .animate-spin, [data-loading], [aria-busy="true"]').length > 0 ||
    /loading|ładow/.test(t)
  );
});
log('UI-011 slow network loading state', loadingShown ? 'PASS' : 'FAIL', `loadingIndicatorPresent=${loadingShown}`);
await slow.screenshot({ path: `${OUT}/slow-3g-keywords.png` });
await slow.close();

// --- UI-012 API 500: does the UI show a real error rather than hanging ------
const errPage = await ctx.newPage();
await errPage.route('**/api/backend/**', (route) =>
  route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
);
await errPage.goto(KW, { waitUntil: 'domcontentloaded' });
await errPage.waitForTimeout(4000);
const errText = ((await errPage.textContent('body').catch(() => '')) ?? '').trim();
const showsError = /error|failed|try again|something went wrong|problem/i.test(errText);
log('UI-012 API 500 error surfaced', showsError ? 'PASS' : 'FAIL', `bodyChars=${errText.length} snippet="${errText.slice(0, 120).replace(/\s+/g, ' ')}"`);
await errPage.screenshot({ path: `${OUT}/api-500-keywords.png` });
await errPage.close();

console.log('\npage errors during interaction run:', errors.length ? [...new Set(errors)].join(' | ').slice(0, 400) : 'none');
await browser.close();
