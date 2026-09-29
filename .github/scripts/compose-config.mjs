import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export function composeConfig(files) {
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
