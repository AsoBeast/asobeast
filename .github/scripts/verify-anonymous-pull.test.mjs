import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./verify-anonymous-pull.mjs", import.meta.url),
);

const PUBLIC = "asobeast/public-image";
const PRIVATE = "asobeast/private-image";
const OPEN = "asobeast/open-image";

let server;
let host;
let tokenRequests;

before(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url, "http://registry.test");

    if (url.pathname === "/token") {
      tokenRequests.push(request.headers);
      const repository = url.searchParams.get("scope").split(":")[1];
      if (repository === PRIVATE) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end('{"errors":[{"code":"UNAUTHORIZED"}]}');
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"token":"anonymous"}');
      return;
    }

    const repository = url.pathname.split("/manifests/")[0].replace("/v2/", "");
    const tag = url.pathname.split("/manifests/")[1];

    if (repository === OPEN) {
      response.writeHead(200, {
        "content-type": "application/vnd.oci.image.index.v1+json",
      });
      response.end();
      return;
    }

    if (request.headers.authorization !== "Bearer anonymous") {
      response.writeHead(401, {
        "www-authenticate": `Bearer realm="http://${host}/token",service="registry.test",scope="repository:${repository}:pull"`,
      });
      response.end();
      return;
    }

    response.writeHead(tag === "missing" ? 404 : 200, {
      "content-type": "application/vnd.oci.image.index.v1+json",
    });
    response.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  host = `127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

function run(...references) {
  tokenRequests = [];
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [
        script,
        ...references.map((reference) => reference.replace("REGISTRY", host)),
      ],
      { env: { ...process.env, DOCKER_CONFIG: "/nonexistent" } },
      (error, stdout, stderr) => {
        resolve({ code: error ? error.code : 0, stdout, stderr });
      },
    );
  });
}

describe("verify-anonymous-pull", () => {
  it("passes for a package the registry hands an anonymous token for", async () => {
    const result = await run(`REGISTRY/${PUBLIC}:1.0.0`);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /pulls without credentials/);
  });

  it("passes when the registry serves the manifest with no challenge at all", async () => {
    const result = await run(`REGISTRY/${OPEN}:1.0.0`);
    assert.equal(result.code, 0);
  });

  it("fails for a private package and names the reference", async () => {
    const result = await run(`REGISTRY/${PRIVATE}:1.0.0`);
    assert.equal(result.code, 1);
    assert.match(result.stderr, new RegExp(`FAIL .*${PRIVATE}:1.0.0.*private`));
    assert.match(result.stderr, /visibility to public/);
  });

  it("fails when the tag is missing from a public package", async () => {
    const result = await run(`REGISTRY/${PUBLIC}:missing`);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /tag does not exist/);
  });

  it("checks every reference and reports each failure", async () => {
    const result = await run(
      `REGISTRY/${PUBLIC}:1.0.0`,
      `REGISTRY/${PRIVATE}:1.0.0`,
      `REGISTRY/${PRIVATE}:latest`,
    );
    assert.equal(result.code, 1);
    assert.match(result.stdout, new RegExp(`${PUBLIC}:1.0.0`));
    assert.match(result.stderr, new RegExp(`${PRIVATE}:1.0.0`));
    assert.match(result.stderr, new RegExp(`${PRIVATE}:latest`));
    assert.match(result.stderr, /2 of 3 images/);
  });

  it("never sends credentials with the token request", async () => {
    await run(`REGISTRY/${PUBLIC}:1.0.0`);
    assert.equal(tokenRequests.length, 1);
    assert.equal(tokenRequests[0].authorization, undefined);
  });

  it("rejects a reference without a tag", async () => {
    const result = await run("REGISTRY/asobeast/no-tag");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /registry\/name:tag form/);
  });

  it("prints usage and exits 2 without arguments", async () => {
    const result = await run();
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Usage/);
  });
});
