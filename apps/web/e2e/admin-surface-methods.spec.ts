import { expect, test } from "./session.mts";

const SURFACES = [
  "/docs",
  "/docs/swagger-ui.css",
  "/docs-json",
  "/docs-yaml",
  "/metrics",
];
const METHODS = ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

test.describe("an anonymous caller on the admin surfaces", () => {
  for (const surface of SURFACES) {
    for (const method of METHODS) {
      test(`${method} ${surface} is not found`, async ({ request }) => {
        const response = await request.fetch(surface, {
          method,
          maxRedirects: 0,
        });

        expect(response.status()).toBe(404);
        expect(response.headers().allow).toBeUndefined();
        expect(response.headers().location).toBeUndefined();
        expect(await response.json()).toMatchObject({
          statusCode: 404,
          error: "Not Found",
          message: `Cannot ${method} ${surface}`,
        });
      });
    }
  }

  test("OPTIONS /admin/queues is not found", async ({ request }) => {
    const response = await request.fetch("/admin/queues", {
      method: "OPTIONS",
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
    expect(response.headers().allow).toBeUndefined();
  });

  test("POST /admin/queues is not found", async ({ request }) => {
    const response = await request.post("/admin/queues", { maxRedirects: 0 });

    expect(response.status()).toBe(404);
  });

  test("GET still reaches the api gate", async ({ request }) => {
    const response = await request.get("/docs-json", { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: "Not Found" });
  });
});
