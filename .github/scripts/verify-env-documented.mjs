#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_EXAMPLE = "apps/api/.env.example";
const COMPOSE_EXAMPLE = ".env.example";
const REFERENCE = "docs/configuration/reference.mdx";
const COMPOSE_SECTION = "Compose only";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function declaredIn(path) {
  return [...read(path).matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
    (match) => match[1],
  );
}

function documentedRows(path) {
  const rows = { api: [], compose: [] };
  for (const section of read(path).split(/^## /m).slice(1)) {
    const kind = section.startsWith(`${COMPOSE_SECTION}\n`) ? "compose" : "api";
    for (const match of section.matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)) {
      rows[kind].push(match[1]);
    }
  }
  return rows;
}

const documented = documentedRows(REFERENCE);
const apiDeclared = declaredIn(API_EXAMPLE);
const composeDeclared = declaredIn(COMPOSE_EXAMPLE);
const missing = apiDeclared.filter((name) => !documented.api.includes(name));
const stale = [
  ...documented.api.filter((name) => !apiDeclared.includes(name)),
  ...documented.compose.filter((name) => !composeDeclared.includes(name)),
];

if (missing.length > 0 || stale.length > 0) {
  console.error(
    `${REFERENCE} must document every variable ${API_EXAMPLE} declares, and each documented variable must be declared by its example (${COMPOSE_EXAMPLE} for the ${COMPOSE_SECTION} section, ${API_EXAMPLE} for the rest).`,
  );
  console.error("It is the one list operators and agents configure from, so a");
  console.error("variable missing from it is a variable nobody configures.");
  console.error("");
  if (missing.length > 0) {
    console.error(`Missing from ${REFERENCE}:`);
    for (const name of missing) console.error(`  ${name}`);
  }
  if (stale.length > 0) {
    console.error("Documented but not declared by its example:");
    for (const name of stale) console.error(`  ${name}`);
  }
  process.exit(1);
}

console.log(
  `${REFERENCE} documents all ${apiDeclared.length} variables ${API_EXAMPLE} declares.`,
);
