#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPOSITIONS = [
  ["docker-compose.yml"],
  ["docker-compose.yml", "docker-compose.tunnel.yml"],
  ["docker-compose.pull.yml"],
  ["docker-compose.pull.yml", "docker-compose.tunnel.yml"],
];

function composeConfig(files) {
  const raw = execFileSync(
    "docker",
    [
      "compose",
      ...files.flatMap((file) => ["-f", file]),
      "config",
      "--format",
      "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? "verify",
        AUTH_SECRET: process.env.AUTH_SECRET ?? "verify".repeat(8),
        ASOBEAST_DOMAIN: process.env.ASOBEAST_DOMAIN ?? "asobeast.example.com",
        TUNNEL_TOKEN: process.env.TUNNEL_TOKEN ?? "verify",
      },
    },
  );
  return JSON.parse(raw);
}

function memoryLimit(service) {
  return service.deploy?.resources?.limits?.memory ?? service.mem_limit;
}

function logOptions(service) {
  const { driver, options } = service.logging ?? {};
  if (driver !== "json-file") return null;
  if (!options?.["max-size"] || !options?.["max-file"]) return null;
  return options;
}

for (const files of COMPOSITIONS) {
  const label = files.join(" + ");
  const { services } = composeConfig(files);
  const unbounded = [];

  for (const [name, service] of Object.entries(services)) {
    if (!memoryLimit(service)) {
      unbounded.push(`${name}: no memory limit`);
    }
    if (!logOptions(service)) {
      unbounded.push(`${name}: no json-file logging limit`);
    }
  }

  if (unbounded.length > 0) {
    console.error(`Every service in ${label} must bound what it can take`);
    console.error("from a single host. These do not:");
    for (const entry of unbounded) console.error(`  ${entry}`);
    console.error("");
    console.error(
      "Add a deploy.resources.limits.memory and a logging block with max-size",
    );
    console.error("and max-file. See docs/operations/capacity.mdx.");
    process.exit(1);
  }

  console.log(
    `Every service in ${label} bounds its memory and its log growth (${Object.keys(services).length} services).`,
  );
}
