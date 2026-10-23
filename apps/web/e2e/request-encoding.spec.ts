import { REQUEST_BODY_LIMIT_BYTES } from "@asobeast/shared";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { expect, test } from "./session.mts";

const PAYLOAD = JSON.stringify({ email: "a@b.c", password: "wrongwrongwrong" });
const ECHO = "/api/backend/__echo/request";
const COMPRESSORS = {
  gzip: gzipSync,
  deflate: deflateSync,
  br: brotliCompressSync,
} as const;

for (const [encoding, compress] of Object.entries(COMPRESSORS)) {
  test(`a ${encoding} body reaches the api with its encoding`, async ({
    request,
  }) => {
    const body = compress(PAYLOAD);

    const response = await request.post(ECHO, {
      headers: {
        "content-type": "application/json",
        "content-encoding": encoding,
      },
      data: body,
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      encoding,
      receivedBytes: body.byteLength,
      decodedBytes: PAYLOAD.length,
      decodedText: PAYLOAD,
    });
  });
}

test("an encoding the api cannot decode gets the api's 415", async ({
  request,
}) => {
  const response = await request.post(ECHO, {
    headers: { "content-type": "application/json", "content-encoding": "zstd" },
    data: PAYLOAD,
  });

  expect(response.status()).toBe(415);
});

test("an uncompressed body is unchanged", async ({ request }) => {
  const response = await request.post(ECHO, {
    headers: { "content-type": "application/json" },
    data: PAYLOAD,
  });

  expect(await response.json()).toMatchObject({
    encoding: null,
    decodedText: PAYLOAD,
  });
});

test("a small compressed body that inflates past the limit is not refused by the proxy", async ({
  request,
}) => {
  const body = gzipSync(Buffer.alloc(REQUEST_BODY_LIMIT_BYTES * 20));

  const response = await request.post(ECHO, {
    headers: { "content-type": "application/json", "content-encoding": "gzip" },
    data: body,
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    receivedBytes: body.byteLength,
    decodedBytes: REQUEST_BODY_LIMIT_BYTES * 20,
  });
});

test("the proxy counts the bytes it receives", async ({ request }) => {
  const response = await request.post(ECHO, {
    headers: { "content-type": "application/json", "content-encoding": "gzip" },
    data: Buffer.alloc(REQUEST_BODY_LIMIT_BYTES + 1, 7),
  });

  expect(response.status()).toBe(413);
});
