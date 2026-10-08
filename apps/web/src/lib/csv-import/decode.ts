export type CsvEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

export interface DecodedCsv {
  text: string;
  encoding: CsvEncoding;
  fallback: boolean;
}

function markedEncoding(bytes: Uint8Array): CsvEncoding | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  return null;
}

const PARITY_SAMPLE_BYTES = 65_536;
const PARITY_DOMINANCE = 4;

function unmarkedUtf16(bytes: Uint8Array): CsvEncoding | null {
  const zeros = [0, 0];
  const length = Math.min(bytes.length, PARITY_SAMPLE_BYTES);
  for (let index = 0; index < length; index += 1) {
    if (bytes[index] === 0) zeros[index % 2] += 1;
  }
  const [even, odd] = zeros;
  if (odd > even * PARITY_DOMINANCE) return "utf-16le";
  if (even > odd * PARITY_DOMINANCE) return "utf-16be";
  return null;
}

const withoutNul = (text: string): string => text.replaceAll("\u0000", "");

function decoded(
  bytes: Uint8Array,
  encoding: CsvEncoding,
  fallback: boolean,
): DecodedCsv {
  return {
    text: withoutNul(new TextDecoder(encoding).decode(bytes)),
    encoding,
    fallback,
  };
}

export function decodeCsvBytes(buffer: ArrayBuffer): DecodedCsv {
  const bytes = new Uint8Array(buffer);
  const encoding = markedEncoding(bytes) ?? unmarkedUtf16(bytes);
  if (encoding) {
    return decoded(bytes, encoding, false);
  }
  try {
    return {
      text: withoutNul(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      encoding: "utf-8",
      fallback: false,
    };
  } catch {
    return decoded(bytes, "windows-1252", true);
  }
}
