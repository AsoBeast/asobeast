import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:3001';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Capture the server-rendered HTML exactly as delivered, before hydration runs.
const ssr = await (await fetch(BASE + '/login')).text();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const hydrated = await page.evaluate(() => document.documentElement.outerHTML);

const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

const a = textOf(ssr);
const b = textOf(hydrated);
console.log('--- SSR text nodes not present in hydrated DOM ---');
a.filter((x) => !b.includes(x)).forEach((x) => console.log('  SSR-ONLY:', JSON.stringify(x.slice(0, 160))));
console.log('--- hydrated text nodes not present in SSR ---');
b.filter((x) => !a.includes(x)).forEach((x) => console.log('  CLIENT-ONLY:', JSON.stringify(x.slice(0, 160))));

// classes on <html> often differ when a theme provider runs
const m = ssr.match(/<html[^>]*>/);
console.log('\nSSR   <html>:', m?.[0]);
console.log('CLIENT<html>:', (await page.evaluate(() => document.documentElement.outerHTML.slice(0, 300))).match(/<html[^>]*>/)?.[0]);

await browser.close();
