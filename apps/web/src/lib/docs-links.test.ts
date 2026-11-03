import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(import.meta.dirname, "..");
const DOCS_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "docs");
const DOCS_LINK = /https:\/\/docs\.asobeast\.com(\/[\w/-]*)?(?:#([\w-]+))?/g;
const HEADING = /^#{1,6} (.+?)(?: \{#([\w-]+)\})?\s*$/gm;
const ACCORDION = /<Accordion title="([^"]+)"/g;

interface DocsLink {
  url: string;
  page: string;
  anchor: string | undefined;
  source: string;
}

function sourceFiles(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name),
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

const pageOf = (path: string | undefined): string =>
  !path || path === "/" ? "index.mdx" : `${path.slice(1)}.mdx`;

function docsLinks(): DocsLink[] {
  return sourceFiles().flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(DOCS_LINK)].map((match) => ({
      url: match[0],
      page: pageOf(match[1]),
      anchor: match[2],
      source: relative(SOURCE_ROOT, file),
    })),
  );
}

const slugOf = (text: string): string =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/ +/g, "-");

function anchorsOf(page: string): Set<string> {
  const mdx = readFileSync(join(DOCS_ROOT, page), "utf8");
  return new Set([
    ...[...mdx.matchAll(HEADING)].map(
      ([, text, id]) => id ?? slugOf(text ?? ""),
    ),
    ...[...mdx.matchAll(ACCORDION)].map(([, title]) => slugOf(title ?? "")),
  ]);
}

const describeLink = ({ url, source }: DocsLink) => `${source}: ${url}`;

describe("documentation links", () => {
  const links = docsLinks();

  it("finds the links it checks", () => {
    expect(links.length).toBeGreaterThan(10);
  });

  it("names a page that exists in docs", () => {
    expect(
      links
        .filter((link) => !existsSync(join(DOCS_ROOT, link.page)))
        .map(describeLink),
    ).toEqual([]);
  });

  it("names an anchor its page defines", () => {
    expect(
      links
        .filter(
          (link) =>
            link.anchor !== undefined &&
            existsSync(join(DOCS_ROOT, link.page)) &&
            !anchorsOf(link.page).has(link.anchor),
        )
        .map(describeLink),
    ).toEqual([]);
  });
});
