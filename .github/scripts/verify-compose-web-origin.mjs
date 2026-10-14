#!/usr/bin/env node
import { composeConfig } from "./compose-config.mjs";

const STACKS = ["docker-compose.yml", "docker-compose.pull.yml"];
const TUNNEL = "docker-compose.tunnel.yml";
const CHOSEN = "https://aso.example.com";
const DOMAIN = "asobeast.example.com";

const webPublicUrl = (files, env) =>
  composeConfig(files, env).services.api?.environment?.WEB_PUBLIC_URL;

function publishedOrigin(file) {
  const ports = composeConfig([file]).services.web?.ports ?? [];
  const published = ports.find((port) => port.target === 3000)?.published;
  return published ? `http://localhost:${published}` : null;
}

const failures = STACKS.flatMap((file) => {
  const expected = [
    [[file], { WEB_PUBLIC_URL: "" }, publishedOrigin(file)],
    [[file], { WEB_PUBLIC_URL: CHOSEN }, CHOSEN],
    [[file, TUNNEL], { ASOBEAST_DOMAIN: DOMAIN }, `https://${DOMAIN}`],
  ];
  return expected.flatMap(([files, env, origin]) => {
    const actual = webPublicUrl(files, env);
    return actual === origin
      ? []
      : [
          `${files.join(" + ")} with ${JSON.stringify(env)}: api WEB_PUBLIC_URL is ${actual ?? "unset"}, expected ${origin}`,
        ];
  });
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(
    "Every link in an email is built from WEB_PUBLIC_URL, so each stack has to",
  );
  console.error(
    "give the API the origin it serves the web app from, never the development",
  );
  console.error("value apps/api/.env carries for pnpm dev.");
  process.exit(1);
}

console.log(
  `${STACKS.join(", ")}: api WEB_PUBLIC_URL is the origin the stack serves`,
);
