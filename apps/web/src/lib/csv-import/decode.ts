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

function unmarkedUtf16(bytes: Uint8Array): CsvEncoding | null {
  if (bytes.length < 4) return null;
  const [first, second, third, fourth] = bytes;
  if (second === 0 && fourth === 0 && first !== 0 && third !== 0) {
    return "utf-16le";
  }
  if (first === 0 && third === 0 && second !== 0 && fourth !== 0) {
    return "utf-16be";
  }
  return null;
}

function decoded(
  bytes: Uint8Array,
  encoding: CsvEncoding,
  fallback: boolean,
): DecodedCsv {
  return { text: new TextDecoder(encoding).decode(bytes), encoding, fallback };
}

export function decodeCsvBytes(buffer: ArrayBuffer): DecodedCsv {
  const bytes = new Uint8Array(buffer);
  const encoding = markedEncoding(bytes) ?? unmarkedUtf16(bytes);
  if (encoding) {
    return decoded(bytes, encoding, false);
  }
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
      fallback: false,
    };
  } catch {
    return decoded(bytes, "windows-1252", true);
  }
}
