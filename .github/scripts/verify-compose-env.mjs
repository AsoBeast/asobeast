#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { composeConfig, root } from "./compose-config.mjs";

const STACKS = ["docker-compose.yml", "docker-compose.pull.yml"];
const EXAMPLES = {
  api: "apps/api/.env.example",
  web: "apps/web/.env.example",
};

function withExamples(read) {
  const dir = mkdtempSync(join(tmpdir(), "asobeast-compose-env-"));
  const override = join(dir, "examples.yml");
  const services = Object.fromEntries(
    Object.entries(EXAMPLES).map(([service, example]) => [
      service,
      { env_file: [{ path: resolve(root, example), required: true }] },
    ]),
  );
  writeFileSync(override, JSON.stringify({ services }));
  try {
    return read(override);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const failures = STACKS.flatMap((file) =>
  withExamples((override) => {
    const { services } = composeConfig([file, override]);
    return Object.keys(EXAMPLES).flatMap((service) =>
      Object.entries(services[service]?.environment ?? {})
        .filter(([, value]) => String(value ?? "").startsWith("#"))
        .map(
          ([name, value]) =>
            `${file}: ${service} ${name} reads ${JSON.stringify(value)} from ${EXAMPLES[service]}`,
        ),
    );
  }),
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
  `${STACKS.join(", ")}: no variable from ${Object.values(EXAMPLES).join(" or ")} reads a comment as its value`,
);
