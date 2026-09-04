import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3002';
const ids = Object.fromEntries(
  readFileSync('/home/user/asobeast/qa/ids.env', 'utf8').trim().split('\n').map((l) => l.split('=')),
);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const auth = await browser.newContext();
const p0 = await auth.newPage();
await p0.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 120000 });
await p0.fill('input[type="email"]', 'qa-owner@asobeast.test');
await p0.fill('input[type="password"]', 'QaOwnerPass123!');
await p0.click('button[type="submit"]');
await p0.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {});
const state = await auth.storageState();
await auth.close();

for (const [name, path] of [
  ['login', '/login'],
  ['dashboard', '/'],
  ['settings', '/settings'],
  ['app-overview', `/apps/${ids.PRIMARY}`],
]) {
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const msgs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/hydrat|did not match|server rendered|tree will be regenerated/i.test(t)) msgs.push(t);
  });
  page.on('pageerror', (e) => {
    if (/hydrat|server rendered/i.test(e.message)) msgs.push('PAGEERROR: ' + e.message);
  });
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(4000);
  console.log(`\n########## ${name} (${msgs.length} hydration messages) ##########`);
  msgs.slice(0, 2).forEach((m) => console.log(m.slice(0, 2500)));
  await ctx.close();
}
await browser.close();
