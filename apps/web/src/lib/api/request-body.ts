import { REQUEST_BODY_LIMIT_BYTES } from "@asobeast/shared";

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super(`The request body is larger than ${REQUEST_BODY_LIMIT_BYTES} bytes.`);
  }
}

function declaredLength(request: Request): number {
  const declared = request.headers.get("content-length");
  return declared === null ? 0 : Number(declared);
}

function joined(chunks: Uint8Array[], length: number): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedBody(
  request: Request,
): Promise<Uint8Array<ArrayBuffer>> {
  if (declaredLength(request) > REQUEST_BODY_LIMIT_BYTES) {
    throw new RequestBodyTooLargeError();
  }
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return joined(chunks, length);
      length += value.byteLength;
      if (length > REQUEST_BODY_LIMIT_BYTES) {
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
