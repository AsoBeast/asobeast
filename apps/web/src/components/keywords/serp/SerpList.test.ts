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

  it("keys a repeat of an app by its place in the list", () => {
    expect(serpRowKeys(listed("111", "222", "111", "111"))).toEqual([
      "app:111",
      "app:222",
      "repeat:2",
      "repeat:3",
    ]);
  });

  it("never hands two rows one key when a store id looks like a key", () => {
    const keys = serpRowKeys(
      listed("repeat:2", "111", "111", "app:111", "repeat:2"),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});
