import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./brand";

const SOURCE_ROOT = join(import.meta.dirname, "..");
const LOWERCASE_NAME = /(?<![\w@/.[-])asobeast(?![\w:\]-]|\.\w)/;
const CLI_SERVER_ARGUMENT = /\bmcp add(?:-json)?\b/;

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

function lowercaseMentions(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line, index) =>
      LOWERCASE_NAME.test(line) && !CLI_SERVER_ARGUMENT.test(line)
        ? [`${relative(SOURCE_ROOT, file)}:${index + 1}`]
        : [],
    );
}

describe("product name", () => {
  it("is AsoBeast", () => {
    expect(PRODUCT_NAME).toBe("AsoBeast");
  });

  it("is never written in lowercase in interface text", () => {
    expect(sourceFiles().flatMap(lowercaseMentions)).toEqual([]);
  });
});
