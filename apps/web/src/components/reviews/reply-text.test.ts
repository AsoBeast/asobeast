import { describe, expect, it } from "vitest";
import { measureReply } from "./reply-text";

describe("measureReply", () => {
  it("counts the trimmed text against the store limit", () => {
    expect(measureReply(`${"a".repeat(350)}\n`, "GOOGLE_PLAY")).toEqual({
      trimmed: "a".repeat(350),
      length: 350,
      limit: 350,
      over: false,
    });
  });

  it("is over only when the trimmed text passes the limit", () => {
    expect(measureReply(`${"a".repeat(351)} `, "GOOGLE_PLAY").over).toBe(true);
    expect(measureReply("a".repeat(351), "APP_STORE").over).toBe(false);
    expect(measureReply("a".repeat(2001), "APP_STORE").over).toBe(true);
  });

  it("trims both ends the way the server does", () => {
    expect(measureReply("\n  hello \t", "APP_STORE").trimmed).toBe("hello");
  });

  it("measures whitespace only text as empty", () => {
    expect(measureReply(" \n ", "GOOGLE_PLAY")).toMatchObject({
      trimmed: "",
      length: 0,
      over: false,
    });
  });

  it("counts characters the way the store does", () => {
    expect(measureReply("ą好".repeat(175), "GOOGLE_PLAY")).toMatchObject({
      length: 350,
      over: false,
    });
  });

  it("counts an emoji once", () => {
    expect(measureReply("😀".repeat(350), "GOOGLE_PLAY")).toMatchObject({
      length: 350,
      over: false,
    });
    expect(measureReply("😀".repeat(351), "GOOGLE_PLAY").over).toBe(true);
  });
});
