import type { IncomingMessage, ServerResponse } from "node:http";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { errorEnvelope } from "./fixtures.mts";

const DECODERS: Record<string, (bytes: Buffer) => Buffer> = {
  gzip: gunzipSync,
  deflate: inflateSync,
  br: brotliDecompressSync,
  identity: (bytes) => bytes,
};
const TEXT_ECHO_LIMIT_BYTES = 1024;

function readBytes(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function reply(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export async function echoRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const encoding = req.headers["content-encoding"] ?? null;
  const received = await readBytes(req);
  const decode =
    encoding === null ? (bytes: Buffer) => bytes : DECODERS[encoding];
  if (decode === undefined) {
    reply(
      res,
      415,
      errorEnvelope(
        415,
        req.url ?? "/",
        `Unsupported content encoding ${encoding}`,
      ),
    );
    return;
  }
  const decoded = decode(received);
  reply(res, 200, {
    encoding,
    receivedBytes: received.byteLength,
    decodedBytes: decoded.byteLength,
    decodedText:
      decoded.byteLength <= TEXT_ECHO_LIMIT_BYTES
        ? decoded.toString("utf8")
        : null,
  });
}
