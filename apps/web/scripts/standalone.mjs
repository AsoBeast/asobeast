import { spawn } from "node:child_process";
import { cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = join(web, ".next", "standalone", "apps", "web");

await cp(join(web, "public"), join(runtime, "public"), { recursive: true });
await cp(join(web, ".next", "static"), join(runtime, ".next", "static"), {
  recursive: true,
});

const server = spawn(process.execPath, [join(runtime, "server.js")], {
  stdio: "inherit",
});
server.on("exit", (code) => process.exit(code ?? 0));
