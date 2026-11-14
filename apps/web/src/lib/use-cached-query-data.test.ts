import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToQueryCache } from "./use-cached-query-data";

const KEY = ["apps", "app-1"];

describe("subscribeToQueryCache", () => {
  const queryClient = new QueryClient();

  afterEach(() => {
    queryClient.clear();
  });

  it("never tells the store about a cache write while the write runs", async () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToQueryCache(queryClient)(onChange);

    queryClient.setQueryData(KEY, { name: "Focus Timer" });

    expect(onChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    unsubscribe();
  });
});
