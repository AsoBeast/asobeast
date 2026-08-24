import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createClient } from "./client.js";
import { ConfigError, loadConfig } from "./config.js";
import { logError, logInfo } from "./log.js";
import { preflight } from "./preflight.js";
import { registerTools } from "./tools/index.js";
import { packageVersion } from "./version.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    logError(error.message);
    process.exitCode = 1;
    return;
  }

  const client = createClient(config);

  const gate = await preflight(client);
  if (!gate.ok) {
    logError(gate.message);
    process.exitCode = 1;
    return;
  }

  const handle = serveStdio(
    () => {
      const server = new McpServer({
        name: "asobeast",
        version: packageVersion(),
      });
      registerTools(server, client);
      return server;
    },
    { onerror: (error) => logError(`stdio transport: ${error.message}`) },
  );
  logInfo(`connected to ${config.apiUrl} on the ${gate.limits}`);

  const shutdown = () => {
    void handle.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
