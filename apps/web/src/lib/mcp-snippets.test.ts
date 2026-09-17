import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import {
  MCP_CLIENTS,
  STDIO_ENTRYPOINT,
  apiOrigin,
  hostedSnippets,
  localSnippets,
  remoteEndpoint,
  snippetById,
  snippetsFor,
} from "./mcp-snippets";

const ORIGIN = "https://aso.example.com";
const TOKEN = "asob_abc";

function hosted(id: string): string {
  return snippetById(hostedSnippets(TOKEN, ORIGIN), id).value;
}

function local(id: string): string {
  return snippetById(localSnippets(TOKEN, ORIGIN), id).value;
}

describe("mcp snippets", () => {
  it("reaches the api through the web origin proxy", () => {
    expect(apiOrigin(ORIGIN)).toBe(`${ORIGIN}/api/backend`);
    expect(remoteEndpoint(ORIGIN)).toBe(`${ORIGIN}/api/backend/mcp`);
  });

  it("sends the token as a bearer header on the remote transport", () => {
    expect(hosted("claude-code-command")).toContain(
      `--header "Authorization: Bearer ${TOKEN}"`,
    );
  });

  it("passes the token as an environment variable on stdio", () => {
    expect(local("claude-code-stdio")).toContain(`ASOBEAST_API_TOKEN=${TOKEN}`);
    const config = JSON.parse(local("claude-desktop-stdio")) as {
      mcpServers: { asobeast: { env: Record<string, string> } };
    };
    expect(config.mcpServers.asobeast.env.ASOBEAST_API_TOKEN).toBe(TOKEN);
  });

  it("quotes the stdio entrypoint so a path with spaces stays one argument", () => {
    expect(local("claude-code-stdio")).toMatch(
      new RegExp(`-- node "${STDIO_ENTRYPOINT}"$`),
    );
  });

  it("never points the stdio server at the mcp endpoint itself", () => {
    expect(local("claude-code-stdio")).not.toContain("/api/backend/mcp");
  });

  it("hands add-json one server entry, not a whole file", () => {
    const command = hosted("claude-code-add-json");
    const entry = command.slice(
      command.indexOf("'") + 1,
      command.lastIndexOf("'"),
    );

    expect(command.startsWith("claude mcp add-json asobeast '")).toBe(true);
    expect(JSON.parse(entry)).toEqual({
      type: "http",
      url: `${ORIGIN}/api/backend/mcp`,
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("keeps the token out of the project file teams commit", () => {
    const project = snippetById(
      hostedSnippets(TOKEN, ORIGIN),
      "claude-code-project",
    );

    expect(project.value).not.toContain(TOKEN);
    expect(JSON.parse(project.value)).toEqual({
      mcpServers: {
        asobeast: {
          type: "http",
          url: `${ORIGIN}/api/backend/mcp`,
          headers: { Authorization: "Bearer ${ASOBEAST_API_TOKEN}" },
        },
      },
    });
    expect(project.location).toContain(".mcp.json");
    expect(project.location).toContain("ASOBEAST_API_TOKEN");
  });

  describe("claude desktop", () => {
    interface DesktopEntry {
      command: string;
      args: string[];
      env: Record<string, string>;
    }

    function desktopEntry(origin: string): DesktopEntry {
      const file = JSON.parse(
        snippetById(hostedSnippets(TOKEN, origin), "claude-desktop").value,
      ) as { mcpServers: { asobeast: DesktopEntry } };
      return file.mcpServers.asobeast;
    }

    it("bridges the hosted endpoint through a pinned mcp-remote", () => {
      const entry = desktopEntry(ORIGIN);

      expect(entry.command).toBe("npx");
      expect(entry.args).toEqual([
        "-y",
        "mcp-remote@0.14.2",
        `${ORIGIN}/api/backend/mcp`,
        "--header",
        "Authorization:${ASOBEAST_AUTH_HEADER}",
      ]);
      expect(entry.env).toEqual({ ASOBEAST_AUTH_HEADER: `Bearer ${TOKEN}` });
      expect(Object.keys(entry).sort()).toEqual(["args", "command", "env"]);
    });

    it("keeps spaces and the token out of every argument", () => {
      for (const arg of desktopEntry(ORIGIN).args) {
        expect(arg).not.toContain(" ");
        expect(arg).not.toContain(TOKEN);
      }
    });

    it.each([
      ["https://aso.example.com", false],
      ["http://localhost:3000", false],
      ["http://127.0.0.1:3001", false],
      ["http://192.168.1.10:3001", true],
      ["http://[::1]:3001", true],
      ["http://asobeast.localhost", true],
    ])("allows plain http for %s only off this machine", (origin, allowed) => {
      const { args } = desktopEntry(origin);
      const endpoint = args.indexOf(`${origin}/api/backend/mcp`);

      expect(args[endpoint + 1] === "--allow-http").toBe(allowed);
      expect(args.includes("--allow-http")).toBe(allowed);
    });

    it("writes its entry before the browser origin is known", () => {
      expect(() => hostedSnippets(TOKEN, "")).not.toThrow();
      expect(desktopEntry("").args).not.toContain("--allow-http");
    });

    it("names the file it belongs in", () => {
      expect(
        snippetById(hostedSnippets(TOKEN, ORIGIN), "claude-desktop").location,
      ).toContain("claude_desktop_config.json");
    });
  });

  it.each([
    ["hosted", hostedSnippets(TOKEN, ORIGIN)],
    ["local", localSnippets(TOKEN, ORIGIN)],
  ])("says where every %s snippet goes", (_kind, snippets) => {
    for (const snippet of snippets) {
      expect(snippet.location).not.toBe("");
    }
  });

  describe("the agent picker", () => {
    const all = [
      ...hostedSnippets(TOKEN, ORIGIN),
      ...localSnippets(TOKEN, ORIGIN),
    ];

    it("offers every agent a snippet is written for", () => {
      for (const snippet of all) {
        expect(MCP_CLIENTS).toContain(snippet.client);
      }
    });

    it("shows only the chosen agent's snippets, in list order", () => {
      const hosted = hostedSnippets(TOKEN, ORIGIN);

      expect(snippetsFor(hosted, "Claude Code").map((s) => s.id)).toEqual(
        hosted
          .filter((snippet) => snippet.client === "Claude Code")
          .map((snippet) => snippet.id),
      );
      expect(
        snippetsFor(hosted, "Claude Desktop").map((snippet) => snippet.id),
      ).toEqual(["claude-desktop"]);
    });
  });

  describe("codex", () => {
    it("writes codex configuration toml that codex reads", () => {
      expect(parse(hosted("codex-config"))).toEqual({
        mcp_servers: {
          asobeast: {
            url: `${ORIGIN}/api/backend/mcp`,
            http_headers: { Authorization: `Bearer ${TOKEN}` },
          },
        },
      });
    });

    it("adds the server with a command that reads the token from the environment", () => {
      expect(hosted("codex-command")).toBe(
        `codex mcp add asobeast --url ${ORIGIN}/api/backend/mcp --bearer-token-env-var ASOBEAST_API_TOKEN`,
      );
      expect(hosted("codex-command")).not.toContain(TOKEN);
    });

    it("runs the stdio server from a checkout", () => {
      expect(parse(local("codex-stdio"))).toEqual({
        mcp_servers: {
          asobeast: {
            command: "node",
            args: [STDIO_ENTRYPOINT],
            env: {
              ASOBEAST_API_URL: `${ORIGIN}/api/backend`,
              ASOBEAST_API_TOKEN: TOKEN,
            },
          },
        },
      });
      expect(local("codex-stdio")).not.toContain("/api/backend/mcp");
    });
  });

  describe("cursor", () => {
    it("writes an mcpServers entry with exactly a url and headers", () => {
      expect(JSON.parse(hosted("cursor"))).toEqual({
        mcpServers: {
          asobeast: {
            url: `${ORIGIN}/api/backend/mcp`,
            headers: { Authorization: `Bearer ${TOKEN}` },
          },
        },
      });
    });

    it("runs the stdio server from a checkout", () => {
      expect(JSON.parse(local("cursor-stdio"))).toEqual({
        mcpServers: {
          asobeast: {
            command: "node",
            args: [STDIO_ENTRYPOINT],
            env: {
              ASOBEAST_API_URL: `${ORIGIN}/api/backend`,
              ASOBEAST_API_TOKEN: TOKEN,
            },
          },
        },
      });
    });
  });

  describe("vs code", () => {
    const file = () =>
      JSON.parse(hosted("vscode")) as {
        inputs: unknown[];
        servers: {
          asobeast: { type: string; headers: Record<string, string> };
        };
      };

    it("uses the servers key with an http server", () => {
      expect(Object.keys(file()).sort()).toEqual(["inputs", "servers"]);
      expect(file().servers.asobeast.type).toBe("http");
    });

    it("prompts for the token once instead of writing it down", () => {
      expect(file().inputs[0]).toEqual({
        type: "promptString",
        id: "asobeast-token",
        description: "asobeast personal API token",
        password: true,
      });
      expect(file().servers.asobeast.headers.Authorization).toBe(
        "Bearer ${input:asobeast-token}",
      );
      expect(hosted("vscode")).not.toContain(TOKEN);
    });
  });

  describe("gemini cli", () => {
    it("names streamable http with httpUrl, never the sse url key", () => {
      expect(JSON.parse(hosted("gemini-settings"))).toEqual({
        mcpServers: {
          asobeast: {
            httpUrl: `${ORIGIN}/api/backend/mcp`,
            headers: { Authorization: `Bearer ${TOKEN}` },
          },
        },
      });
    });

    it("adds the server with one command", () => {
      expect(hosted("gemini-command")).toBe(
        `gemini mcp add --transport http --scope user --header "Authorization: Bearer ${TOKEN}" asobeast ${ORIGIN}/api/backend/mcp`,
      );
    });
  });

  it("names the windsurf url key serverUrl", () => {
    expect(JSON.parse(hosted("windsurf"))).toEqual({
      mcpServers: {
        asobeast: {
          serverUrl: `${ORIGIN}/api/backend/mcp`,
          headers: { Authorization: `Bearer ${TOKEN}` },
        },
      },
    });
  });

  it("describes the endpoint for any other client", () => {
    const other = hosted("other");

    expect(other).toContain(`${ORIGIN}/api/backend/mcp`);
    expect(other).toContain("Streamable HTTP");
    expect(other).toContain(`Header     Authorization: Bearer ${TOKEN}`);
  });
});
