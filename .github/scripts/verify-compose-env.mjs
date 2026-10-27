#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { composeConfig, root } from "./compose-config.mjs";

const EXAMPLES = ["apps/api/.env.example", "apps/web/.env.example"];

function probeServices() {
  return Object.fromEntries(
    EXAMPLES.map((example, index) => [
      `example-${index}`,
      {
        image: "scratch",
        env_file: [{ path: resolve(root, example), required: true }],
      },
    ]),
  );
}

function resolvedExamples() {
  const dir = mkdtempSync(join(tmpdir(), "asobeast-compose-env-"));
  const probe = join(dir, "examples.yml");
  writeFileSync(probe, JSON.stringify({ services: probeServices() }));
  try {
    return composeConfig([probe]).services;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const services = resolvedExamples();
const failures = EXAMPLES.flatMap((example, index) =>
  Object.entries(services[`example-${index}`]?.environment ?? {})
    .filter(([, value]) => String(value ?? "").startsWith("#"))
    .map(([name]) => `${example}: ${name} reads a comment as its value`),
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error("");
  console.error(
    "Compose trims the whitespace after = and only treats a # as a comment when",
  );
  console.error(
    "a space precedes it inside the value, so KEY=   # note reads as the value",
  );
  console.error(
    '"# note". Put the comment of an empty variable on its own line above it.',
  );
  process.exit(1);
}

console.log(
  `${EXAMPLES.join(", ")}: Compose reads no comment as a variable's value`,
);
