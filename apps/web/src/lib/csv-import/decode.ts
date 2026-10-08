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
const PARITY_FREQUENT_SHARE = 32;
const STRAY_CONTROL = /[\u0001-\u0008\u000b\u000c\u000e-\u001f]/;

function strictUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function parityEncoding(even: number, odd: number): CsvEncoding | null {
  if (odd > even * PARITY_DOMINANCE) return "utf-16le";
  if (even > odd * PARITY_DOMINANCE) return "utf-16be";
  return null;
}

function unmarkedUtf16(
  bytes: Uint8Array,
  utf8: string | null,
): CsvEncoding | null {
  const zeros = [0, 0];
  const length = Math.min(bytes.length, PARITY_SAMPLE_BYTES);
  for (let index = 0; index < length; index += 1) {
    if (bytes[index] === 0) zeros[index % 2] += 1;
  }
  const [even, odd] = zeros;
  const encoding = parityEncoding(even, odd);
  if (encoding === null) return null;
  const frequent =
    Math.max(even, odd) >=
    Math.max(2, Math.floor(length / PARITY_FREQUENT_SHARE));
  const cleanUtf8 = utf8 !== null && !STRAY_CONTROL.test(utf8);
  return frequent || !cleanUtf8 ? encoding : null;
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
  const marked = markedEncoding(bytes);
  if (marked) return decoded(bytes, marked, false);
  const utf8 = strictUtf8(bytes);
  const utf16 = unmarkedUtf16(bytes, utf8);
  if (utf16) return decoded(bytes, utf16, false);
  if (utf8 !== null) {
    return { text: withoutNul(utf8), encoding: "utf-8", fallback: false };
  }
  return decoded(bytes, "windows-1252", true);
}
