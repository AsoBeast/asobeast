#!/usr/bin/env node
import { composeConfig } from "./compose-config.mjs";

const COMPOSITIONS = [
  ["docker-compose.yml"],
  ["docker-compose.yml", "docker-compose.tunnel.yml"],
  ["docker-compose.pull.yml"],
  ["docker-compose.pull.yml", "docker-compose.tunnel.yml"],
];

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
