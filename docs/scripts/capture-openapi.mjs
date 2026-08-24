import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.ASOBEAST_API_URL ?? "http://localhost:4000";
const TOKEN = process.env.ASOBEAST_API_TOKEN;
const CHECK = process.argv.includes("--check");
const OUTPUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "api-reference",
  "openapi.json",
);

function explain(status) {
  if (status === 404) {
    return "the OpenAPI surface is owner gated by default, set ASOBEAST_API_TOKEN or start the API with API_DOCS=public";
  }
  if (status === 401 || status === 403) {
    return "ASOBEAST_API_TOKEN was rejected, mint a fresh owner token in Settings";
  }
  return "the API answered unexpectedly";
}

function serialize(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function operationsOf(document, path) {
  return Object.keys(document.paths?.[path] ?? {}).sort();
}

function describeDrift(committed, live) {
  const committedPaths = Object.keys(committed.paths ?? {});
  const livePaths = Object.keys(live.paths ?? {});
  const added = livePaths.filter((path) => !committedPaths.includes(path));
  const removed = committedPaths.filter((path) => !livePaths.includes(path));
  const changed = livePaths
    .filter((path) => committedPaths.includes(path))
    .filter(
      (path) =>
        JSON.stringify(committed.paths[path]) !==
        JSON.stringify(live.paths[path]),
    );

  const lines = [];
  for (const path of added) {
    lines.push(`  + ${path} [${operationsOf(live, path).join(", ")}]`);
  }
  for (const path of removed) {
    lines.push(`  - ${path} [${operationsOf(committed, path).join(", ")}]`);
  }
  for (const path of changed) {
    lines.push(`  ~ ${path} [${operationsOf(live, path).join(", ")}]`);
  }
  if (lines.length === 0) {
    lines.push(
      "  the paths match but the document differs, so info, servers, tags or components changed",
    );
  }
  return lines;
}

async function readCommitted() {
  try {
    return JSON.parse(await readFile(OUTPUT, "utf8"));
  } catch {
    throw new Error(
      `${OUTPUT} is missing or not JSON, run pnpm docs:openapi against a running API first`,
    );
  }
}

async function fetchDocument() {
  const url = `${BASE_URL.replace(/\/$/, "")}/docs-json`;
  const response = await fetch(url, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  });

  if (!response.ok) {
    throw new Error(
      `GET ${url} returned ${response.status}: ${explain(response.status)}`,
    );
  }

  const body = await response.text();
  let document;
  try {
    document = JSON.parse(body);
  } catch {
    throw new Error(
      `GET ${url} returned ${response.status} but the body is not JSON, so ASOBEAST_API_URL points at something other than the API`,
    );
  }

  const paths = Object.keys(document.paths ?? {}).length;
  if (paths === 0) {
    throw new Error(
      `GET ${url} returned a document with no paths, so the API did not boot fully`,
    );
  }

  return { document, paths, url };
}

async function main() {
  const { document, paths, url } = await fetchDocument();

  if (!CHECK) {
    await mkdir(dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, serialize(document), "utf8");
    console.log(`wrote ${OUTPUT} with ${paths} paths from ${url}`);
    return;
  }

  const committed = await readCommitted();
  if (serialize(committed) === serialize(document)) {
    console.log(`${OUTPUT} matches the API at ${url} across ${paths} paths`);
    return;
  }

  console.error(`${OUTPUT} has drifted from the API at ${url}:`);
  for (const line of describeDrift(committed, document)) {
    console.error(line);
  }
  console.error("run pnpm docs:openapi against a running API to recapture");
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
