import { SESSION_COOKIE } from "@asobeast/shared";
import { expect, test } from "./session.mts";

const PROBE = { "next-action": "x", rsc: "1", cookie: `${SESSION_COOKIE}=e2e` };

for (const path of ["/nope", "/api/nope"]) {
  test(`a server action probe of ${path} is not found instead of failing`, async ({
    request,
  }) => {
    const response = await request.post(path, {
      headers: PROBE,
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
    expect(response.headers()["x-nextjs-action-not-found"]).toBe("1");
  });
}
