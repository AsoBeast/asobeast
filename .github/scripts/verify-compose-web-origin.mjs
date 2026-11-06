#!/usr/bin/env node
import { composeConfig } from "./compose-config.mjs";

const STACKS = [
  "docker-compose.yml",
  "docker-compose.pull.yml",
  "docker-compose.portainer.yml",
];
const TUNNEL = "docker-compose.tunnel.yml";
const CHOSEN = "https://aso.example.com";
const DOMAIN = "asobeast.example.com";
const PORTS = [
  [{ ASOBEAST_PORT: "" }, "3001"],
  [{ ASOBEAST_PORT: "3101" }, "3101"],
];

const webPublicUrl = (config) =>
  config.services.api?.environment?.WEB_PUBLIC_URL;

const publishedPort = (config) =>
  (config.services.web?.ports ?? []).find((port) => port.target === 3000)
    ?.published ?? null;

const mismatch = (label, name, actual, expected) =>
  actual === expected
    ? []
    : [`${label}: ${name} is ${actual ?? "unset"}, expected ${expected}`];

function checkPort(file, env, port) {
  const label = `${file} with ${JSON.stringify(env)}`;
  const config = composeConfig([file], { ...env, WEB_PUBLIC_URL: "" });
  return [
    ...mismatch(label, "the published web port", publishedPort(config), port),
    ...mismatch(
      label,
      "api WEB_PUBLIC_URL",
      webPublicUrl(config),
      `http://localhost:${port}`,
    ),
  ];
}

function checkOverrides(file) {
  const chosen = composeConfig([file], { WEB_PUBLIC_URL: CHOSEN });
  const tunnel = composeConfig([file, TUNNEL], {
    ASOBEAST_DOMAIN: DOMAIN,
    ASOBEAST_PORT: "3101",
  });
  const overlay = `${file} + ${TUNNEL}`;
  return [
    ...mismatch(
      `${file} with WEB_PUBLIC_URL`,
      "api WEB_PUBLIC_URL",
      webPublicUrl(chosen),
      CHOSEN,
    ),
    ...mismatch(
      overlay,
      "api WEB_PUBLIC_URL",
      webPublicUrl(tunnel),
      `https://${DOMAIN}`,
    ),
    ...mismatch(overlay, "the published web port", publishedPort(tunnel), null),
  ];
}

const failures = STACKS.flatMap((file) => [
  ...PORTS.flatMap(([env, port]) => checkPort(file, env, port)),
  ...checkOverrides(file),
]);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(
    "Every link in an email is built from WEB_PUBLIC_URL, so each stack has to",
  );
  console.error(
    "give the API the origin it serves the web app from, never the development",
  );
  console.error("value apps/api/.env carries for pnpm dev.");
  console.error(
    "ASOBEAST_PORT moves the published port, and the default origin has to move with it.",
  );
  process.exit(1);
}

console.log(
  `${STACKS.join(", ")}: api WEB_PUBLIC_URL is the origin the stack serves, on the port ASOBEAST_PORT publishes`,
);
