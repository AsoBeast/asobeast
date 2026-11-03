import { describe, expect, it } from "vitest";
import {
  readSeenRelease,
  SEEN_RELEASE_KEY,
  writeSeenRelease,
} from "./seen-release";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

const throwing = (): Storage => {
  throw new Error("storage is blocked");
};

describe("seen release", () => {
  it("keeps the value under its own key", () => {
    expect(SEEN_RELEASE_KEY).toBe("asobeast.whatsNew.seen");
  });

  it("reads nothing when nothing was stored", () => {
    const storage = memoryStorage();
    expect(readSeenRelease(() => storage)).toBeNull();
  });

  it("reads the stored release", () => {
    const storage = memoryStorage();
    storage.setItem(SEEN_RELEASE_KEY, "1.14.0");
    expect(readSeenRelease(() => storage)).toBe("1.14.0");
  });

  it("reads an empty value as nothing", () => {
    const storage = memoryStorage();
    storage.setItem(SEEN_RELEASE_KEY, "");
    expect(readSeenRelease(() => storage)).toBeNull();
  });

  it("reads nothing when storage throws", () => {
    expect(readSeenRelease(throwing)).toBeNull();
  });

  it("stores a release and says so", () => {
    const storage = memoryStorage();
    expect(writeSeenRelease(() => storage, "1.15.0")).toBe(true);
    expect(storage.getItem(SEEN_RELEASE_KEY)).toBe("1.15.0");
  });

  it("answers false when storage throws on write", () => {
    expect(writeSeenRelease(throwing, "1.15.0")).toBe(false);
  });
});
