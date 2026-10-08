import { describe, expect, it } from "vitest";
import { decodeCsvBytes } from "./decode";

const TEXT = "keyword;country\r\nżółw;pl\r\n";

const arrayBufferOf = (bytes: Buffer): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

const utf8WithBom = Buffer.concat([
  Buffer.from([0xef, 0xbb, 0xbf]),
  Buffer.from(TEXT, "utf8"),
]);
const utf16leWithBom = Buffer.concat([
  Buffer.from([0xff, 0xfe]),
  Buffer.from(TEXT, "utf16le"),
]);
const utf16beWithBom = Buffer.concat([
  Buffer.from([0xfe, 0xff]),
  Buffer.from(TEXT, "utf16le").swap16(),
]);

describe("decodeCsvBytes", () => {
  it("reads UTF-8 and drops its byte order mark", () => {
    expect(decodeCsvBytes(arrayBufferOf(utf8WithBom))).toEqual({
      text: TEXT,
      encoding: "utf-8",
      fallback: false,
    });
  });

  it("reads UTF-16LE with a byte order mark, as Excel's Unicode Text writes it", () => {
    expect(decodeCsvBytes(arrayBufferOf(utf16leWithBom))).toEqual({
      text: TEXT,
      encoding: "utf-16le",
      fallback: false,
    });
  });

  it("reads UTF-16BE with a byte order mark", () => {
    expect(decodeCsvBytes(arrayBufferOf(utf16beWithBom))).toEqual({
      text: TEXT,
      encoding: "utf-16be",
      fallback: false,
    });
  });

  it("falls back to Windows-1252 for bytes that are not UTF-8 and says so", () => {
    const bytes = Buffer.from([0x6b, 0x65, 0x79, 0x20, 0xe9, 0x80]);

    expect(decodeCsvBytes(arrayBufferOf(bytes))).toEqual({
      text: "key é€",
      encoding: "windows-1252",
      fallback: true,
    });
  });

  it("reads plain UTF-8 with CJK and Thai without a fallback", () => {
    const text = "keyword\n习惯追踪器\nตัวจับเวลา\n";

    expect(decodeCsvBytes(arrayBufferOf(Buffer.from(text, "utf8")))).toEqual({
      text,
      encoding: "utf-8",
      fallback: false,
    });
  });

  it("recognises UTF-16LE without a byte order mark by the zero bytes of ASCII", () => {
    const bytes = Buffer.from("keyword,country\n", "utf16le");

    expect(decodeCsvBytes(arrayBufferOf(bytes)).encoding).toBe("utf-16le");
    expect(decodeCsvBytes(arrayBufferOf(bytes)).text).toBe("keyword,country\n");
  });

  it("recognises UTF-16BE without a byte order mark", () => {
    const bytes = Buffer.from("keyword,country\n", "utf16le").swap16();

    expect(decodeCsvBytes(arrayBufferOf(bytes))).toMatchObject({
      encoding: "utf-16be",
      text: "keyword,country\n",
    });
  });

  it("recognises UTF-16LE without a byte order mark that starts with Cyrillic", () => {
    const text = "ключевое слово,страна\nпривет,ru\n";

    expect(decodeCsvBytes(arrayBufferOf(Buffer.from(text, "utf16le")))).toEqual(
      { text, encoding: "utf-16le", fallback: false },
    );
  });

  it("recognises UTF-16BE without a byte order mark that starts with Cyrillic", () => {
    const text = "ключ;страна\r\nпривет;ru\r\n";

    expect(
      decodeCsvBytes(arrayBufferOf(Buffer.from(text, "utf16le").swap16())),
    ).toMatchObject({ text, encoding: "utf-16be" });
  });

  it("recognises UTF-16LE without a byte order mark that starts with CJK", () => {
    const text = "关键词,国家\n习惯追踪器,cn\n";

    expect(
      decodeCsvBytes(arrayBufferOf(Buffer.from(text, "utf16le"))),
    ).toMatchObject({ text, encoding: "utf-16le", fallback: false });
  });

  it("recognises UTF-16LE without a byte order mark for a Thai list with no header", () => {
    const text = "แอปติดตามนิสัยประจำวัน\nตัวจับเวลาโฟกัสสำหรับงาน\n";

    expect(decodeCsvBytes(arrayBufferOf(Buffer.from(text, "utf16le")))).toEqual(
      { text, encoding: "utf-16le", fallback: false },
    );
  });

  it("recognises UTF-16LE without a byte order mark for long CJK lines with no header", () => {
    const text = "习惯追踪器每日计划提醒专注计时工具番茄工作法\n".repeat(3);

    expect(decodeCsvBytes(arrayBufferOf(Buffer.from(text, "utf16le")))).toEqual(
      { text, encoding: "utf-16le", fallback: false },
    );
  });

  it("never hands a NUL character on", () => {
    const bytes = Buffer.from([0x00, 0x6b, 0x65, 0x00, 0x00, 0x79, 0x0a]);

    expect(decodeCsvBytes(arrayBufferOf(bytes)).text).not.toContain("\u0000");
  });

  it("keeps UTF-8 with one stray NUL byte as UTF-8", () => {
    const bytes = Buffer.concat([
      Buffer.from("k", "utf8"),
      Buffer.from([0x00]),
      Buffer.from(TEXT.slice(1), "utf8"),
    ]);

    expect(decodeCsvBytes(arrayBufferOf(bytes))).toEqual({
      text: TEXT,
      encoding: "utf-8",
      fallback: false,
    });
  });

  it("reads an empty file as empty text", () => {
    expect(decodeCsvBytes(new ArrayBuffer(0))).toEqual({
      text: "",
      encoding: "utf-8",
      fallback: false,
    });
  });
});
