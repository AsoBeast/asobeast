import { describe, expect, it } from "vitest";
import { serpRowKeys } from "./SerpList";

const listed = (...storeAppIds: string[]) =>
  storeAppIds.map((storeAppId) => ({ storeAppId }));

describe("serpRowKeys", () => {
  it("keys each row by the app it shows, wherever it ranks", () => {
    const today = serpRowKeys(listed("111", "222", "333"));
    const yesterday = serpRowKeys(listed("333", "111", "222"));

    expect(today).toEqual(["app:111", "app:222", "app:333"]);
    expect(yesterday).toEqual(["app:333", "app:111", "app:222"]);
  });

  it("keys a repeat of an app by the app and its place in the list", () => {
    expect(serpRowKeys(listed("111", "222", "111", "111"))).toEqual([
      "app:111",
      "app:222",
      "repeat:111:2",
      "repeat:111:3",
    ]);
  });

  it("remounts a repeated row when another app repeats in its place", () => {
    const today = serpRowKeys(listed("111", "222", "111"));
    const yesterday = serpRowKeys(listed("111", "222", "222"));

    expect(today[2]).not.toBe(yesterday[2]);
  });

  it("never hands two rows one key when a store id looks like a key", () => {
    const keys = serpRowKeys(
      listed("repeat:111:2", "111", "111", "app:111", "repeat:111:2"),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
