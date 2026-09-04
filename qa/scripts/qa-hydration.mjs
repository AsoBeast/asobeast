/**
 * Isolate which route(s) throw a React hydration error, using a fresh page per
 * route so listeners cannot bleed between routes.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3001';
const ids = Object.fromEntries(
  readFileSync('/home/user/asobeast/qa/ids.env', 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split('=')),
);

const ROUTES = [
  ['login', '/login'],
  ['register', '/register'],
  ['forgot-password', '/forgot-password'],
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
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// authenticate once
const auth = await browser.newContext();
const p0 = await auth.newPage();
await p0.goto(BASE + '/login', { waitUntil: 'networkidle' });
await p0.fill('input[type="email"]', 'qa-owner@asobeast.test');
await p0.fill('input[type="password"]', 'QaOwnerPass123!');
await p0.click('button[type="submit"]');
await p0.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
const state = await auth.storageState();
await auth.close();

for (const [name, path] of ROUTES) {
  const ctx = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydrat|did not match|418|423|425/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 300));
  });
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => errs.push('nav: ' + e.message));
  await page.waitForTimeout(2500);
  const hyd = errs.filter((e) => /418|423|425|hydrat/i.test(e));
  console.log(`${hyd.length ? 'HYDRATION' : 'clean    '}  ${name.padEnd(20)} ${hyd.length ? hyd.join(' | ').slice(0, 240) : ''}`);
  if (errs.length && !hyd.length) console.log(`            other: ${errs.slice(0, 2).join(' | ').slice(0, 200)}`);
  await ctx.close();
}

await browser.close();
