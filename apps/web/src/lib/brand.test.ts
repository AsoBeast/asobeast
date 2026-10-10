import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { EMAIL_MARK_PATH } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./brand";

const SOURCE_ROOT = join(import.meta.dirname, "..");
const PUBLIC_ROOT = join(import.meta.dirname, "..", "..", "public");
const PNG_SIGNATURE = "89504e470d0a1a0a";
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

describe("email brand mark", () => {
  const file = readFileSync(join(PUBLIC_ROOT, EMAIL_MARK_PATH));

  it("is a png", () => {
    expect(file.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
  });

  it("is 96 pixels square for a 48 pixel header on 2x screens", () => {
    expect([file.readUInt32BE(16), file.readUInt32BE(20)]).toEqual([96, 96]);
  });

  it("stays small enough to download on every open", () => {
    expect(file.byteLength).toBeLessThan(12_000);
  });
});
