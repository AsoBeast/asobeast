import { describe, expect, it } from "vitest";
import { mcpTokenNotice, mcpTokenScope } from "./mcp-token-scope";

describe("mcpTokenScope", () => {
  it("mints a read only token unless changes are allowed", () => {
    expect(mcpTokenScope(false)).toBe("read");
  });

  it("mints a write token when changes are allowed", () => {
    expect(mcpTokenScope(true)).toBe("write");
  });
});

describe("mcpTokenNotice", () => {
  it("tells the owner a read only token cannot change anything", () => {
    expect(mcpTokenNotice("read")).toBe(
      "The token is read-only and is shown once. Copy what you need before closing.",
    );
  });

  it("tells the owner a write token can change things and must stay private", () => {
    expect(mcpTokenNotice("write")).toBe(
      "The token can make changes and is shown once. Copy what you need before closing, and keep it private.",
    );
  });
});
