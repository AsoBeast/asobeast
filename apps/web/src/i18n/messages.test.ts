import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/locale";
import { loadMessages, messageNamespaces } from "./messages";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function valueAt(messages: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, messages);
}

describe("message catalogs", () => {
  it("loads every namespace for both locales", async () => {
    const [english, chinese] = await Promise.all(
      LOCALES.map((locale) => loadMessages(locale)),
    );

    for (const namespace of messageNamespaces) {
      expect(english, `en.${namespace}`).toHaveProperty(namespace);
      expect(chinese, `zh-CN.${namespace}`).toHaveProperty(namespace);
    }
  });

  it("keeps identical key sets at every depth", async () => {
    const [english, chinese] = await Promise.all(
      LOCALES.map((locale) => loadMessages(locale)),
    );

    expect(leafPaths(chinese).sort()).toEqual(leafPaths(english).sort());
  });

  it("has no empty translations", async () => {
    for (const locale of LOCALES) {
      const messages = await loadMessages(locale);
      for (const path of leafPaths(messages)) {
        expect(valueAt(messages, path), `${locale}.${path}`).not.toBe("");
      }
    }
  });

  it("parses every translation as ICU", async () => {
    for (const locale of LOCALES) {
      const messages = await loadMessages(locale);
      for (const path of leafPaths(messages)) {
        const message = valueAt(messages, path);
        expect(
          () => new IntlMessageFormat(String(message), locale),
          `${locale}.${path}`,
        ).not.toThrow();
      }
    }
  });
});
