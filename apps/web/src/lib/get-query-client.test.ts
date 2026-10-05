import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { getQueryClient } from "./get-query-client";
import { authMeKey } from "./queries";
import { retryDelayFor } from "./query-retry";

async function refuseMutation(statusCode: number) {
  const client = getQueryClient();
  client.setQueryData(authMeKey, { id: "u1" });
  await client
    .getMutationCache()
    .build(client, {
      mutationFn: () =>
        Promise.reject(
          new ApiError({
            statusCode,
            error: "Refused",
            message: "This workspace is suspended.",
            path: "/apps",
            timestamp: "2026-10-05T10:00:00.000Z",
          }),
        ),
    })
    .execute(undefined)
    .catch(() => undefined);
  return client.getQueryState(authMeKey)?.isInvalidated;
}

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

  it("reads the account again after a write is refused as forbidden", async () => {
    await expect(refuseMutation(403)).resolves.toBe(true);
  });

  it("keeps the account after a write fails for another reason", async () => {
    await expect(refuseMutation(409)).resolves.toBe(false);
  });

  it("wires the shared retry delay into the query defaults", () => {
    expect(getQueryClient().getDefaultOptions().queries?.retryDelay).toBe(
      retryDelayFor,
    );
  });
});
