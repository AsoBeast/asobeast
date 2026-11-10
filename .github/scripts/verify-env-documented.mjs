#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_EXAMPLE = "apps/api/.env.example";
const EXAMPLES = [API_EXAMPLE, "apps/web/.env.example", ".env.example"];
const REFERENCE = "docs/configuration/reference.mdx";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function declaredIn(path) {
  return [...read(path).matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
    (match) => match[1],
  );
}

function documentedIn(path) {
  return [...read(path).matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)].map(
    (match) => match[1],
  );
}

const documented = documentedIn(REFERENCE);
const apiDeclared = declaredIn(API_EXAMPLE);
const declared = EXAMPLES.flatMap(declaredIn);
const missing = apiDeclared.filter((name) => !documented.includes(name));
const stale = documented.filter((name) => !declared.includes(name));

if (missing.length > 0 || stale.length > 0) {
  console.error(
    `${REFERENCE} must document every variable ${API_EXAMPLE} declares and only variables an example declares.`,
  );
  console.error("It is the one list operators and agents configure from, so a");
  console.error("variable missing from it is a variable nobody configures.");
  console.error("");
  if (missing.length > 0) {
    console.error(`Missing from ${REFERENCE}:`);
    for (const name of missing) console.error(`  ${name}`);
  }
  if (stale.length > 0) {
    console.error("Documented but declared by no example:");
    for (const name of stale) console.error(`  ${name}`);
  }
  process.exit(1);
}

console.log(
  `${REFERENCE} documents all ${apiDeclared.length} variables ${API_EXAMPLE} declares.`,
);
