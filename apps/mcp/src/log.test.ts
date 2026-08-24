import { API_TOKEN_PREFIX } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logError, logInfo } from "./log.js";

const TOKEN = `${API_TOKEN_PREFIX}${"c".repeat(48)}`;

function captureStderr(): { written: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      chunks.push(chunk.toString());
      return true;
    });
  return { written: () => chunks.join(""), restore: () => spy.mockRestore() };
}

afterEach(() => vi.restoreAllMocks());

describe("the stderr log", () => {
  it("keeps a personal api token out of a reported error", () => {
    const stderr = captureStderr();

    logError(`stdio transport: refused Bearer ${TOKEN}`);
    const written = stderr.written();
    stderr.restore();

    expect(written).not.toContain(TOKEN);
    expect(written).toContain("[redacted]");
  });

  it("keeps a personal api token out of an informational line", () => {
    const stderr = captureStderr();

    logInfo(`connected with ${TOKEN}`);
    const written = stderr.written();
    stderr.restore();

    expect(written).not.toContain(TOKEN);
  });

  it("keeps credentials embedded in an api url out of the log", () => {
    const stderr = captureStderr();

    logInfo("connected to http://owner:hunter2@api.example.com/backend");
    const written = stderr.written();
    stderr.restore();

    expect(written).not.toContain("hunter2");
    expect(written).toContain("api.example.com/backend");
  });

  it("leaves a message that carries no token untouched", () => {
    const stderr = captureStderr();

    logInfo("connected to http://localhost:4000 on the Indie plan");
    const written = stderr.written();
    stderr.restore();

    expect(written).toBe(
      "[asobeast-mcp] connected to http://localhost:4000 on the Indie plan\n",
    );
  });
});
