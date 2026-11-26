import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_RULES,
  ACTION_STATUSES,
  APP_LOCALIZATION_ORIGINS,
  CHANGE_FIELDS,
  CATEGORY_COLLECTIONS,
} from "@asobeast/shared";
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

function invalidKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  const entries = Array.isArray(value)
    ? value.map((child, index) => [String(index), child] as const)
    : Object.entries(value);
  return entries.flatMap(([key, child]) => [
    ...(key.includes(".") ? [`${prefix ? `${prefix}.` : ""}${key}`] : []),
    ...invalidKeys(child, `${prefix ? `${prefix}.` : ""}${key}`),
  ]);
}

function valueAt(messages: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, messages);
}

function placeholders(
  message: string,
  locale: (typeof LOCALES)[number],
): string[] {
  const names = new Set<string>();
  const richKeys = new Set(
    [...message.matchAll(/<([a-zA-Z]\w*)>/g)].map(([, name]) => name),
  );
  const values = new Proxy(Object.create(null) as Record<string, number>, {
    get(_target, key) {
      if (typeof key === "string") names.add(key);
      return typeof key === "string" && richKeys.has(key) ? () => "" : 1;
    },
    has() {
      return true;
    },
  });
  new IntlMessageFormat(message, locale).format(values);
  return [...names].sort();
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

describe("message catalogs", () => {
  it("registers the complete namespace contract", () => {
    expect(messageNamespaces).toEqual([
      "common",
      "navigation",
      "auth",
      "errors",
      "ui",
      "format",
      "shell",
      "seo",
      "datePicker",
      "validation",
      "languages",
      "legal",
      "localizations",
      "systemNotices",
      "billing",
      "account",
      "settings",
      "team",
      "workspace",
      "notifications",
      "dashboard",
      "apps",
      "setup",
      "overview",
      "appDetail",
      "jobs",
      "metrics",
      "keywords",
      "keywordInspector",
      "rankings",
      "competitors",
      "metadata",
      "screenshots",
      "changes",
      "audit",
      "actions",
      "alerts",
      "charts",
      "topCharts",
      "reviews",
      "admin",
      "integrations",
      "releaseNotes",
    ]);
  });

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

  it("keeps identical interpolation arguments in both locales", async () => {
    const [english, chinese] = await Promise.all(
      LOCALES.map((locale) => loadMessages(locale)),
    );
    const paths = leafPaths(english).sort();

    for (const path of paths) {
      expect(
        placeholders(String(valueAt(chinese, path)), "zh-CN"),
        `zh-CN.${path}`,
      ).toEqual(placeholders(String(valueAt(english, path)), "en"));
    }
  });

  it("uses namespace keys without dots", async () => {
    for (const locale of LOCALES) {
      const messages = await loadMessages(locale);
      expect(invalidKeys(messages), locale).toEqual([]);
    }
  });

  it("gives every namespace at least one translation", async () => {
    for (const locale of LOCALES) {
      const messages = await loadMessages(locale);
      for (const namespace of messageNamespaces) {
        expect(
          leafPaths(messages[namespace]),
          `${locale}.${namespace}`,
        ).not.toEqual([]);
      }
    }
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

  it("references only catalog keys from source", async () => {
    const messages = await loadMessages("en");
    const known = new Set(leafPaths(messages));
    const missing: string[] = [];

    for (const path of sourceFiles(join(process.cwd(), "src"))) {
      const source = readFileSync(path, "utf8");
      const namespaces = [
        ...source.matchAll(
          /useTranslations\(\s*"([^"]+)"|namespace:\s*"([^"]+)"/g,
        ),
      ].flatMap((match) =>
        [match[1], match[2]].filter((value): value is string => Boolean(value)),
      );
      const keys = [
        ...source.matchAll(/\b(?:t|translator)\(\s*"([^"]+)"/g),
      ].map((match) => match[1]);

      const prefixes = [
        ...source.matchAll(/\b(?:t|translator)\(\s*`([^`]*)\$\{/g),
      ].map((match) => match[1]);
      for (const prefix of prefixes) {
        if (!prefix.endsWith(".")) continue;
        const found =
          namespaces.some((namespace) =>
            [...known].some((path) =>
              path.startsWith(`${namespace}.${prefix}`),
            ),
          ) || [...known].some((path) => path.includes(`.${prefix}`));
        if (!found) missing.push(`${path}: ${prefix}…`);
      }

      for (const key of keys) {
        const found = key.includes(".")
          ? [...known].some((path) => path === key || path.endsWith(`.${key}`))
          : namespaces.length > 0
            ? namespaces.some((namespace) => known.has(`${namespace}.${key}`))
            : [...known].some((path) => path.endsWith(`.${key}`));
        if (!found) missing.push(`${path}: ${key}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("translates every localization origin", async () => {
    const [english, chinese] = await Promise.all(
      LOCALES.map((locale) => loadMessages(locale)),
    );
    const englishOrigins = valueAt(english, "localizations.origin");
    const chineseOrigins = valueAt(chinese, "localizations.origin");
    for (const origin of APP_LOCALIZATION_ORIGINS) {
      expect(
        englishOrigins,
        `en.localizations.origin.${origin}`,
      ).toHaveProperty(origin);
      expect(
        chineseOrigins,
        `zh-CN.localizations.origin.${origin}`,
      ).toHaveProperty(origin);
    }
  });

  it("catches missing dynamic enum keys in both catalogs", async () => {
    const [english, chinese] = await Promise.all(
      LOCALES.map((locale) => loadMessages(locale)),
    );
    const dynamic = [
      ...ACTION_RULES.map(
        (value) => ["actions.rules", value.replace(/[._]/g, "-")] as const,
      ),
      ...ACTION_STATUSES.map(
        (value) => ["actions.statuses", value.toLowerCase()] as const,
      ),
      ...ACTION_PRIORITIES.map(
        (value) => ["actions.priorities", value] as const,
      ),
      ...ACTION_CATEGORIES.map(
        (value) => ["actions.categories", value] as const,
      ),
      ...CHANGE_FIELDS.map(
        (value) => ["actions.evidenceFields", value] as const,
      ),
      ...CATEGORY_COLLECTIONS.map(
        (value) => ["topCharts.collections", value] as const,
      ),
    ];
    for (const [path, key] of dynamic) {
      expect(valueAt(english, path), `en.${path}.${key}`).toHaveProperty(key);
      expect(valueAt(chinese, path), `zh-CN.${path}.${key}`).toHaveProperty(
        key,
      );
    }
  });
});
