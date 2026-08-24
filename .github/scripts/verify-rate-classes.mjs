#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const controllerRoot = join(root, "apps", "api", "src");
const openApiPath = join(root, "docs", "api-reference", "openapi.json");

const STORE_MARKER = "limiter.consume(";
const STORE_CLASS = "@SpendsStoreCapacity()";
const HTTP_DECORATOR = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*('([^']*)')?/;
const CONTROLLER_DECORATOR = /^@Controller\(\s*('([^']*)')?/;

function controllerFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return controllerFiles(path);
    return entry.endsWith(".controller.ts") ? [path] : [];
  });
}

function apiPath(base, route) {
  const segments = [base, route]
    .filter((segment) => segment.length > 0)
    .join("/")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment.startsWith(":") ? `{${segment.slice(1)}}` : segment,
    );
  return `/${segments.join("/")}`;
}

function decoratorStart(lines, httpLine) {
  let start = httpLine;
  while (start > 0 && lines[start - 1].trimStart().startsWith("@")) start -= 1;
  return start;
}

function scan(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  const routes = [];
  const leaks = [];
  let base = "";
  let current = null;

  lines.forEach((line, index) => {
    const controller = CONTROLLER_DECORATOR.exec(line);
    if (controller) base = controller[2] ?? "";

    const http = HTTP_DECORATOR.exec(line);
    if (http) {
      current = {
        method: http[1].toLowerCase(),
        path: apiPath(base, http[3] ?? ""),
        line: index,
        decorators: lines
          .slice(decoratorStart(lines, index), index + 1)
          .join("\n"),
        store: false,
      };
      routes.push(current);
      return;
    }

    if (!current || !line.includes(STORE_MARKER)) return;
    const region = lines.slice(current.line, index + 1).join("\n");
    current.store = true;
    if (
      !region.includes(STORE_CLASS) &&
      !current.decorators.includes(STORE_CLASS)
    ) {
      leaks.push(
        `${file}:${index + 1} ${current.method.toUpperCase()} ${current.path}`,
      );
    }
  });

  return { routes, leaks };
}

const scanned = controllerFiles(controllerRoot).map((file) => ({
  file,
  ...scan(file),
}));

const leaks = scanned.flatMap(({ leaks: found }) => found);
const classified = new Set(
  scanned.flatMap(({ routes }) =>
    routes.map(({ method, path }) => `${method} ${path}`),
  ),
);

const document = JSON.parse(readFileSync(openApiPath, "utf8"));
const unclassified = Object.entries(document.paths).flatMap(([path, methods]) =>
  Object.keys(methods)
    .map((method) => `${method} ${path}`)
    .filter((operation) => !classified.has(operation)),
);

if (leaks.length > 0) {
  console.error(
    "These endpoints spend store capacity without an explicit rate class:",
  );
  for (const leak of leaks) console.error(`  ${leak}`);
}

if (unclassified.length > 0) {
  console.error("These documented endpoints carry no rate class:");
  for (const operation of unclassified) console.error(`  ${operation}`);
}

if (leaks.length > 0 || unclassified.length > 0) {
  console.error(
    "Add @SpendsStoreCapacity() to every handler that reaches the store, and re-run pnpm docs:openapi after changing a controller.",
  );
  process.exit(1);
}

const storeRoutes = scanned.flatMap(({ routes }) =>
  routes.filter(({ store }) => store),
);
console.log(
  `Classified ${classified.size} endpoints, ${storeRoutes.length} of them store-touching.`,
);
