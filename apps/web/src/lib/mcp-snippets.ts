export const STDIO_ENTRYPOINT =
  "/absolute/path/to/asobeast/apps/mcp/dist/index.js";

export function apiOrigin(origin?: string): string {
  const base =
    origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/api/backend`;
}

export function remoteEndpoint(origin?: string): string {
  return `${apiOrigin(origin)}/mcp`;
}

export function remoteCommand(token: string, origin?: string): string {
  return `claude mcp add --transport http asobeast ${remoteEndpoint(origin)} --header "Authorization: Bearer ${token}"`;
}

export function remoteConfig(token: string, origin?: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        asobeast: {
          type: "http",
          url: remoteEndpoint(origin),
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

export function stdioCommand(token: string, origin?: string): string {
  return `claude mcp add asobeast --env ASOBEAST_API_URL=${apiOrigin(origin)} --env ASOBEAST_API_TOKEN=${token} -- node ${STDIO_ENTRYPOINT}`;
}

export function stdioConfig(token: string, origin?: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        asobeast: {
          command: "node",
          args: [STDIO_ENTRYPOINT],
          env: {
            ASOBEAST_API_URL: apiOrigin(origin),
            ASOBEAST_API_TOKEN: token,
          },
        },
      },
    },
    null,
    2,
  );
}
