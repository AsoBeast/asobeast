import { describe, expect, it } from "vitest";
import { getQueryClient } from "./get-query-client";
import { retryDelayFor } from "./query-retry";

describe("getQueryClient", () => {
  it("spends no extra request retrying while the server renders", async () => {
    let attempts = 0;

    await getQueryClient()
      .fetchQuery({
        queryKey: ["server-retry"],
        queryFn: () => {
          attempts += 1;
          throw new Error("the api is down");
        },
      })
      .catch(() => undefined);

    expect(attempts).toBe(1);
  });

  it("wires the shared retry delay into the query defaults", () => {
    expect(getQueryClient().getDefaultOptions().queries?.retryDelay).toBe(
      retryDelayFor,
    );
  });
});
