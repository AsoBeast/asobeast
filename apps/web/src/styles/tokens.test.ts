import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { TEXT_PAIRS } from "@/components/tokens/token-groups";

type Scope = Record<string, string>;

function read(file: string): string {
  return readFileSync(join(import.meta.dirname, file), "utf8");
}

function declarations(css: string, selector: string): Scope {
  const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css);
  if (!block) throw new Error(`no ${selector} block found`);
  const scope: Scope = {};
  for (const [, name, value] of block[1]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    scope[name!] = value!.replace(/\s+/g, " ").trim();
  }
  return scope;
}

function resolve(token: string, scope: Scope): string {
  let value = scope[token];
  for (let depth = 0; value?.includes("var(") && depth < 10; depth += 1) {
    let missing = false;
    value = value.replace(/var\((--[\w-]+)\)/g, (_reference, name: string) => {
      const nested = scope[name];
      if (nested === undefined) missing = true;
      return nested ?? "";
    });
    if (missing) return "";
  }
  return value ?? "";
}

const primitives = read("primitives.css");
const semantic = read("semantic.css");

const THEMES = {
  light: {
    ...declarations(primitives, ":root"),
    ...declarations(semantic, ":root"),
  },
  dark: {
    ...declarations(primitives, ":root"),
    ...declarations(semantic, "\\.dark"),
  },
} satisfies Record<string, Scope>;

describe("design tokens", () => {
  it("defines the same token names in both themes", () => {
    const light = Object.keys(declarations(semantic, ":root")).sort();
    const dark = Object.keys(declarations(semantic, "\\.dark")).sort();
    expect(dark).toEqual(light);
  });

  it("resolves every semantic value to a literal", () => {
    const unresolved = Object.entries(THEMES).flatMap(([theme, scope]) =>
      Object.keys(declarations(semantic, ":root"))
        .filter((token) => {
          const value = resolve(token, scope);
          return !value || value.includes("var(");
        })
        .map((token) => `${theme} ${token}`),
    );

    expect(unresolved).toEqual([]);
  });

  it("counts a reference nested inside an expression as unresolved", () => {
    const scope: Scope = {
      "--green-600": "oklch(0.6 0.15 150)",
      "--resolved": "color-mix(in oklch, var(--green-600) 12%, transparent)",
      "--dangling": "color-mix(in oklch, var(--gone) 12%, transparent)",
    };

    expect(resolve("--resolved", scope)).toBe(
      "color-mix(in oklch, oklch(0.6 0.15 150) 12%, transparent)",
    );
    expect(resolve("--dangling", scope)).toBe("");
  });

  it("keeps every literal colour in the primitive layer", () => {
    const semanticLiterals = Object.entries({
      ...declarations(semantic, ":root"),
      ...declarations(semantic, "\\.dark"),
    }).filter(
      ([name, value]) =>
        !name.startsWith("--elevation-") &&
        /oklch\(|#[0-9a-f]{3,8}\b|\brgb\(/i.test(value),
    );

    expect(semanticLiterals.map(([name]) => name)).toEqual([]);
  });
});

describe.each(Object.entries(THEMES))("%s theme contrast", (_theme, scope) => {
  it.each(TEXT_PAIRS)(
    "$label clears $floor:1",
    ({ foreground, background, floor }) => {
      const ratio = contrastRatio(
        resolve(foreground, scope),
        resolve(background, scope),
      );

      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(floor);
    },
  );
});
