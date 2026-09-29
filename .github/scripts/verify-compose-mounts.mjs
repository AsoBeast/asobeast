#!/usr/bin/env node
import { resolve } from "node:path";
import { composeConfig, root } from "./compose-config.mjs";

const STACKS = ["docker-compose.yml", "docker-compose.pull.yml"];
const KEYS_SOURCE = resolve(root, "apps/api/keys");
const KEYS_TARGET = "/repo/apps/api/keys";

const failures = STACKS.flatMap((file) => {
  const volumes = composeConfig([file]).services.api?.volumes ?? [];
  const keys = volumes.find((volume) => volume.target === KEYS_TARGET);
  if (!keys) {
    return [`${file}: api does not mount ${KEYS_TARGET}`];
  }
  const problems = [];
  if (keys.type !== "bind" || keys.source !== KEYS_SOURCE) {
    problems.push(`${file}: ${KEYS_TARGET} must bind apps/api/keys`);
  }
  if (!keys.read_only) {
    problems.push(`${file}: ${KEYS_TARGET} must be read only`);
  }
  return problems;
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(
    "The API resolves APPLE_ADS_PRIVATE_KEY_PATH=keys/... against /repo/apps/api,",
  );
  console.error(
    "and the image never contains the git ignored keys directory, so every",
  );
  console.error("stack has to mount it or the Apple Ads sync cannot sign in.");
  process.exit(1);
}

console.log(`${STACKS.join(", ")}: api mounts apps/api/keys read only`);
