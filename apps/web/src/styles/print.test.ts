import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  const path = join(import.meta.dirname, file);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const semantic = read("semantic.css");
const globals = read("../app/globals.css");
const print = read("print.css");

describe("print theme", () => {
  it("scopes the dark tokens to the screen", () => {
    expect(semantic).toMatch(/@media screen\s*\{\s*\.dark\s*\{/);
    expect(semantic).not.toMatch(/^\.dark\s*\{/m);
  });

  it("applies the dark variant on screen only", () => {
    expect(globals).toMatch(
      /@custom-variant dark\s*\{\s*@media screen\s*\{\s*&:is\(\.dark \*\)\s*\{\s*@slot;/,
    );
  });

  it("declares the dark colour scheme on screen only", () => {
    expect(globals).toMatch(
      /@media screen\s*\{\s*\.dark\s*\{\s*color-scheme: dark;/,
    );
  });

  it("forces the light colour scheme in print", () => {
    expect(print).toMatch(
      /@media print\s*\{\s*:root\s*\{\s*color-scheme: light !important;/,
    );
  });

  it("imports the print stylesheet after every other stylesheet", () => {
    const imports = [...globals.matchAll(/^@import "([^"]+)";$/gm)].map(
      ([, path]) => path,
    );
    expect(imports.at(-1)).toBe("../styles/print.css");
  });
});
