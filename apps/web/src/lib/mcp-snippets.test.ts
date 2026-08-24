import { describe, expect, it } from "vitest";
import {
  apiOrigin,
  remoteCommand,
  remoteConfig,
  remoteEndpoint,
  stdioCommand,
  stdioConfig,
} from "./mcp-snippets";

const ORIGIN = "https://aso.example.com";
const TOKEN = "asob_abc";

describe("mcp snippets", () => {
  it("reaches the api through the web origin proxy", () => {
    expect(apiOrigin(ORIGIN)).toBe(`${ORIGIN}/api/backend`);
    expect(remoteEndpoint(ORIGIN)).toBe(`${ORIGIN}/api/backend/mcp`);
  });

  it("sends the token as a bearer header on the remote transport", () => {
    expect(remoteCommand(TOKEN, ORIGIN)).toContain(
      `--header "Authorization: Bearer ${TOKEN}"`,
    );
    expect(JSON.parse(remoteConfig(TOKEN, ORIGIN))).toEqual({
      mcpServers: {
        asobeast: {
          type: "http",
          url: `${ORIGIN}/api/backend/mcp`,
          headers: { Authorization: `Bearer ${TOKEN}` },
        },
      },
    });
  });

  it("passes the token as an environment variable on stdio", () => {
    expect(stdioCommand(TOKEN, ORIGIN)).toContain(
      `ASOBEAST_API_TOKEN=${TOKEN}`,
    );
    const config = JSON.parse(stdioConfig(TOKEN, ORIGIN)) as {
      mcpServers: { asobeast: { env: Record<string, string> } };
    };
    expect(config.mcpServers.asobeast.env.ASOBEAST_API_TOKEN).toBe(TOKEN);
  });

  it("never points the stdio server at the mcp endpoint itself", () => {
    expect(stdioCommand(TOKEN, ORIGIN)).not.toContain("/api/backend/mcp");
  });
});
