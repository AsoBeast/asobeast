#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = "release-please-config.json";
const WORKSPACE = "pnpm-workspace.yaml";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function valueAt(document, jsonpath) {
  return jsonpath
    .replace(/^\$\.?/, "")
    .split(".")
    .reduce((node, key) => node?.[key], document);
}

function workspaceGlobs() {
  const lines = read(WORKSPACE).split("\n");
  const globs = [];
  for (const line of lines.slice(
    lines.findIndex((entry) => entry.trim() === "packages:") + 1,
  )) {
    const entry = line.match(/^\s+-\s*"?([^"\s]+)"?\s*$/);
    if (!entry) break;
    globs.push(entry[1]);
  }
  return globs;
}

function manifestsUnder(glob) {
  if (!glob.endsWith("/*")) return [`${glob}/package.json`];
  const parent = glob.slice(0, -2);
  return readdirSync(resolve(root, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parent}/${entry.name}/package.json`);
}

const { version } = readJson("package.json");
const bumped = new Map(
  (readJson(CONFIG).packages["."]["extra-files"] ?? [])
    .filter((file) => file.type === "json")
    .map((file) => [file.path, file.jsonpath]),
);

const stale = [...bumped]
  .filter(([path, jsonpath]) => valueAt(readJson(path), jsonpath) !== version)
  .map(([path]) => path);

const unregistered = workspaceGlobs()
  .flatMap(manifestsUnder)
  .filter((path) => existsSync(resolve(root, path)))
  .filter((path) => !bumped.has(path))
  .filter((path) => readJson(path).version === version);

if (stale.length > 0 || unregistered.length > 0) {
  console.error(
    `Registered JSON files and workspace manifests must read ${version}.`,
  );
  console.error("A file that states a version Release Please does not bump");
  console.error("goes stale at the next release, and the drift check that");
  console.error("reads it fails on the release pull request rather than on");
  console.error("the change that caused it.");
  console.error("");
  if (stale.length > 0) {
    console.error(`${CONFIG} bumps these, but they do not read ${version}:`);
    for (const path of stale) console.error(`  ${path}`);
    console.error("");
    console.error("Set the version by hand, or restore the jsonpath the entry");
    console.error("declares if the file was reshaped.");
    console.error("");
  }
  if (unregistered.length > 0) {
    console.error(`These carry ${version} but ${CONFIG} does not bump them:`);
    for (const path of unregistered) console.error(`  ${path}`);
    console.error("");
    console.error(`Add an extra-files entry for each one to ${CONFIG}.`);
  }
  process.exit(1);
}

console.log(
  `Release Please bumps ${bumped.size} versioned files, all reading ${version}.`,
);
