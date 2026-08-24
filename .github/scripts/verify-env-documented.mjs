#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXAMPLE = "apps/api/.env.example";
const INSTRUCTIONS = "AGENTS.md";
const HEADING = "`apps/api/.env`:";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function names(text) {
  return [...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
}

function documentedBlock(text) {
  const after = text.split(HEADING)[1];
  if (after === undefined) {
    throw new Error(`${INSTRUCTIONS} no longer contains the ${HEADING} block.`);
  }
  const fenced = after.split("```")[1];
  if (fenced === undefined) {
    throw new Error(`The ${HEADING} block in ${INSTRUCTIONS} is not fenced.`);
  }
  return fenced;
}

const declared = names(read(EXAMPLE));
const documented = names(documentedBlock(read(INSTRUCTIONS)));

const missing = declared.filter((name) => !documented.includes(name));
const stale = documented.filter((name) => !declared.includes(name));

if (missing.length > 0 || stale.length > 0) {
  console.error(
    `${INSTRUCTIONS} must list exactly the variables ${EXAMPLE} declares.`,
  );
  console.error("It is the file every contributor and agent reads first, so a");
  console.error("variable missing from it is a variable nobody configures.");
  console.error("");
  if (missing.length > 0) {
    console.error(`Missing from ${INSTRUCTIONS}:`);
    for (const name of missing) console.error(`  ${name}`);
  }
  if (stale.length > 0) {
    console.error(`Documented but no longer in ${EXAMPLE}:`);
    for (const name of stale) console.error(`  ${name}`);
  }
  process.exit(1);
}

console.log(
  `${INSTRUCTIONS} documents all ${declared.length} variables ${EXAMPLE} declares.`,
);
