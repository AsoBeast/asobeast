#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPOSE = "docker-compose.pull.yml";

const { version } = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const compose = readFileSync(resolve(root, COMPOSE), "utf8");

const defaults = [
  ...compose.matchAll(/\$\{ASOBEAST_IMAGE_TAG:-([^}]+)\}/g),
].map((match) => match[1]);

if (defaults.length === 0) {
  console.error(`${COMPOSE} declares no ASOBEAST_IMAGE_TAG default.`);
  console.error(
    "Every image it runs must default to the current release, or an",
  );
  console.error("installation that sets no tag silently runs something else.");
  process.exit(1);
}

const stale = defaults.filter((tag) => tag !== version);

if (stale.length > 0) {
  console.error(
    `${COMPOSE} defaults to ${[...new Set(stale)].join(", ")} but this repository is at ${version}.`,
  );
  console.error("");
  console.error(
    "An installation that does not set ASOBEAST_IMAGE_TAG would run the",
  );
  console.error(
    "wrong images without any error, so the default has to track the",
  );
  console.error("release. Release Please bumps it through the");
  console.error(
    "x-release-please-version annotation on each image line; if that",
  );
  console.error(
    "annotation was removed or the line was reshaped, restore it and",
  );
  console.error("set the default to the current version by hand.");
  process.exit(1);
}

console.log(
  `${COMPOSE} runs ${defaults.length} images, all defaulting to ${version}.`,
);
