/**
 * QA UI sweep. Visits every reachable route, records console errors, page errors,
 * failed requests, horizontal overflow and any XSS dialog, and screenshots each page.
 * Run from apps/web: node ../../qa/ui-sweep.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3001';
const OUT = '/home/user/asobeast/qa/evidence/ui';
mkdirSync(OUT, { recursive: true });

const ids = Object.fromEntries(
  readFileSync('/home/user/asobeast/qa/ids.env', 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('=')),
);

const ROUTES = [
  ['dashboard', '/'],
  ['actions', '/actions'],
  ['settings', '/settings'],
  ['tokens', '/tokens'],
  ['app-overview', `/apps/${ids.PRIMARY}`],
  ['app-keywords', `/apps/${ids.PRIMARY}/keywords`],
  ['app-rankings', `/apps/${ids.PRIMARY}/rankings`],
  ['app-competitors', `/apps/${ids.PRIMARY}/competitors`],
  ['app-reviews', `/apps/${ids.PRIMARY}/reviews`],
  ['app-metadata', `/apps/${ids.PRIMARY}/metadata`],
  ['app-audit', `/apps/${ids.PRIMARY}/audit`],
  ['app-changes', `/apps/${ids.PRIMARY}/changes`],
  ['app-actions', `/apps/${ids.PRIMARY}/actions`],
  ['app-setup', `/apps/${ids.PRIMARY}/setup`],
  ['unicode-app-overview', `/apps/${ids.UNICODE}`],
  ['unicode-app-keywords', `/apps/${ids.UNICODE}/keywords`],
];

const findings = [];
const record = (route, kind, detail) => {
  findings.push({ route, kind, detail: String(detail).slice(0, 600) });
};

const attach = (page, name) => {
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') record(name, `console.${t}`, m.text());
  });
  page.on('pageerror', (e) => record(name, 'pageerror', e.message));
  page.on('requestfailed', (r) =>
    record(name, 'requestfailed', `${r.method()} ${r.url()} :: ${r.failure()?.errorText}`),
  );
  page.on('response', (r) => {
    if (r.status() >= 400) record(name, `http.${r.status()}`, `${r.request().method()} ${r.url()}`);
  });
  page.on('dialog', async (d) => {
    record(name, 'XSS-DIALOG', `${d.type()}: ${d.message()}`);
    await d.dismiss();
  });
};

const overflow = (page) =>
  page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// ---- 1. Logged-out: protected routes must redirect, not flash content --------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attach(page, 'logged-out');
  for (const [name, path] of [['dashboard', '/'], ['settings', '/settings'], ['app', `/apps/${ids.PRIMARY}`]]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const url = page.url();
    const body = (await page.textContent('body')) ?? '';
    findings.push({
      route: `logged-out:${name}`,
      kind: 'redirect-check',
      detail: `landed=${url} | mentionsAppName=${body.includes('GeoGuess')}`,
    });
    await page.screenshot({ path: `${OUT}/loggedout-${name}.png`, fullPage: false });
  }
  await ctx.close();
}

// ---- 2. Log in through the UI ------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, 'login');
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${OUT}/login.png` });
await page.fill('input[type="email"]', 'qa-owner@asobeast.test');
await page.fill('input[type="password"]', 'QaOwnerPass123!');
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
findings.push({ route: 'login', kind: 'post-login-url', detail: page.url() });
await page.screenshot({ path: `${OUT}/after-login.png` });

// ---- 3. Desktop sweep of every route ----------------------------------------
for (const [name, path] of ROUTES) {
  attach(page, name);
  const t0 = Date.now();
  const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => {
    record(name, 'navigation-error', e.message);
    return null;
  });
  await page.waitForTimeout(1200);
  const ms = Date.now() - t0;
  const o = await overflow(page).catch(() => ({ scrollW: 0, clientW: 0 }));
  findings.push({
    route: name,
    kind: 'loaded',
    detail: `status=${resp?.status()} ms=${ms} scrollW=${o.scrollW} clientW=${o.clientW}`,
  });
  await page.screenshot({ path: `${OUT}/desktop-${name}.png`, fullPage: true });
}

// ---- 4. XSS rendering check on the pages that hold hostile seeded strings ----
for (const [name, path] of [
  ['xss-changes', `/apps/${ids.PRIMARY}/changes`],
  ['xss-reviews', `/apps/${ids.PRIMARY}/reviews`],
  ['xss-competitors', `/apps/${ids.PRIMARY}/competitors`],
  ['xss-keywords', `/apps/${ids.PRIMARY}/keywords`],
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const injected = await page.evaluate(() =>
    document.querySelectorAll('script:not([src]):not([type])').length,
  );
  const escapedVisible = (await page.textContent('body'))?.includes('<script>alert(1)</script>');
  findings.push({
    route: name,
    kind: 'xss-check',
    detail: `inlineScriptNodes=${injected} escapedTextVisible=${escapedVisible}`,
  });
}

// ---- 5. Mobile 375px sweep ---------------------------------------------------
const mctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  storageState: await ctx.storageState(),
});
const mpage = await mctx.newPage();
for (const [name, path] of ROUTES) {
  attach(mpage, `mobile:${name}`);
  await mpage.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => record(`mobile:${name}`, 'navigation-error', e.message));
  await mpage.waitForTimeout(800);
  const o = await overflow(mpage).catch(() => ({ scrollW: 0, clientW: 0 }));
  findings.push({
    route: `mobile:${name}`,
    kind: o.scrollW > o.clientW + 1 ? 'HORIZONTAL-OVERFLOW' : 'mobile-ok',
    detail: `scrollW=${o.scrollW} clientW=${o.clientW}`,
  });
  await mpage.screenshot({ path: `${OUT}/mobile-${name}.png`, fullPage: true });
}
await mctx.close();

// ---- 6. Dark mode ------------------------------------------------------------
const dctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  storageState: await ctx.storageState(),
});
const dpage = await dctx.newPage();
attach(dpage, 'dark');
for (const [name, path] of [['dashboard', '/'], ['app-keywords', `/apps/${ids.PRIMARY}/keywords`], ['app-overview', `/apps/${ids.PRIMARY}`]]) {
  await dpage.goto(BASE + path, { waitUntil: 'networkidle' });
  await dpage.waitForTimeout(800);
  await dpage.screenshot({ path: `${OUT}/dark-${name}.png`, fullPage: true });
}
await dctx.close();

// ---- 7. Keyboard-only navigation of the keyword page -------------------------
await page.goto(BASE + `/apps/${ids.PRIMARY}/keywords`, { waitUntil: 'networkidle' });
const tabOrder = [];
for (let i = 0; i < 15; i += 1) {
  await page.keyboard.press('Tab');
  tabOrder.push(
    await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return 'none';
      const style = getComputedStyle(el);
      const visibleFocus =
        style.outlineStyle !== 'none' || style.boxShadow !== 'none' || el.matches(':focus-visible');
      return `${el.tagName}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} focusRing=${visibleFocus}`;
    }),
  );
}
findings.push({ route: 'keyboard', kind: 'tab-order', detail: tabOrder.join(' -> ') });

// ---- 8. Session expiry: drop the cookie, then act ----------------------------
await ctx.clearCookies();
await page.goto(BASE + `/apps/${ids.PRIMARY}/keywords`, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
findings.push({
  route: 'session-expiry',
  kind: 'after-cookie-drop',
  detail: `url=${page.url()} bodyHasAppName=${((await page.textContent('body')) ?? '').includes('GeoGuess')}`,
});
await page.screenshot({ path: `${OUT}/session-expiry.png` });

await browser.close();
writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
for (const f of findings) console.log(`[${f.kind}] ${f.route} :: ${f.detail}`);
