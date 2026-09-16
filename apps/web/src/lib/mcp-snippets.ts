export const STDIO_ENTRYPOINT =
  "/absolute/path/to/asobeast/apps/mcp/dist/index.js";

export type SnippetLanguage = "bash" | "json";

export interface ConnectSnippet {
  id: string;
  client: string;
  label: string;
  location: string;
  language: SnippetLanguage;
  value: string;
}

export function apiOrigin(origin?: string): string {
  const base =
    origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/api/backend`;
}

export function remoteEndpoint(origin?: string): string {
  return `${apiOrigin(origin)}/mcp`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function mcpServersFile(entry: unknown): string {
  return json({ mcpServers: { asobeast: entry } });
}

export function hostedSnippets(
  token: string,
  origin?: string,
): ConnectSnippet[] {
  const endpoint = remoteEndpoint(origin);
  return [
    {
      id: "claude-code-command",
      client: "Claude Code",
      label: "Claude Code",
      location: "",
      language: "bash",
      value: `claude mcp add --transport http asobeast ${endpoint} --header "Authorization: Bearer ${token}"`,
    },
    {
      id: "claude-desktop",
      client: "Claude Desktop",
      label: "Claude Desktop config",
      location: "",
      language: "json",
      value: mcpServersFile({
        type: "http",
        url: endpoint,
        headers: { Authorization: `Bearer ${token}` },
      }),
    },
  ];
}

export function localSnippets(
  token: string,
  origin?: string,
): ConnectSnippet[] {
  const api = apiOrigin(origin);
  return [
    {
      id: "claude-code-stdio",
      client: "Claude Code",
      label: "Claude Code stdio",
      location: "",
      language: "bash",
      value: `claude mcp add asobeast --env ASOBEAST_API_URL=${api} --env ASOBEAST_API_TOKEN=${token} -- node ${STDIO_ENTRYPOINT}`,
    },
    {
      id: "claude-desktop-stdio",
      client: "Claude Desktop",
      label: "Claude Desktop stdio config",
      location: "",
      language: "json",
      value: mcpServersFile({
        command: "node",
        args: [STDIO_ENTRYPOINT],
        env: { ASOBEAST_API_URL: api, ASOBEAST_API_TOKEN: token },
      }),
    },
  ];
}

export function snippetById(
  snippets: ConnectSnippet[],
  id: string,
): ConnectSnippet {
  const snippet = snippets.find((candidate) => candidate.id === id);
  if (!snippet) throw new Error(`no connect snippet named ${id}`);
  return snippet;
}
