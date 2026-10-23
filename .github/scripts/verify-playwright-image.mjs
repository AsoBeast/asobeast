#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WORKFLOW = ".github/workflows/ci.yml";
const LOCKFILE = "pnpm-lock.yaml";
const IMAGE_TAG = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble/g;
const INSTALLED = /^\s+'?@playwright\/test@(\d+\.\d+\.\d+)/m;

const lockfile = readFileSync(resolve(root, LOCKFILE), "utf8");
const installed = lockfile.match(INSTALLED)?.[1];

if (!installed) {
  console.error(`${LOCKFILE} does not resolve @playwright/test.`);
  process.exit(1);
}

const workflow = readFileSync(resolve(root, WORKFLOW), "utf8");
const tags = [...workflow.matchAll(IMAGE_TAG)].map((match) => match[1]);

if (tags.length === 0) {
  console.error(`${WORKFLOW} runs no job in the Playwright image.`);
  console.error("The webkit project runs there so that no apt package is");
  console.error("installed; without that job its libraries come back via apt.");
  process.exit(1);
}

const stale = [...new Set(tags.filter((tag) => tag !== installed))];

if (stale.length > 0) {
  console.error(
    `${WORKFLOW} runs the Playwright image at v${stale.join(", v")} but ${LOCKFILE} installs @playwright/test ${installed}.`,
  );
  console.error("");
  console.error("The image carries the browsers of exactly one Playwright");
  console.error("version, so a mismatch fails the webkit job with a missing");
  console.error("browser. Set every mcr.microsoft.com/playwright image tag in");
  console.error(`${WORKFLOW} to v${installed}-noble.`);
  process.exit(1);
}

console.log(
  `${WORKFLOW} runs the Playwright image at v${installed}-noble, matching ${LOCKFILE}.`,
);
