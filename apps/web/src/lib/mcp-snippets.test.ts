import { describe, expect, it } from "vitest";
import {
  apiOrigin,
  hostedSnippets,
  localSnippets,
  remoteEndpoint,
  snippetById,
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

    it("names the file it belongs in", () => {
      expect(
        snippetById(hostedSnippets(TOKEN, ORIGIN), "claude-desktop").location,
      ).toContain("claude_desktop_config.json");
    });
  });
});
