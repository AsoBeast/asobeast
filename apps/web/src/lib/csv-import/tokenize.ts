import { namesKeyword } from "./columns";

export const DELIMITERS = [",", ";", "\t", "|"] as const;

export type Delimiter = (typeof DELIMITERS)[number];

export interface CsvRecord {
  line: number;
  cells: string[];
}

export interface CsvTable {
  delimiter: Delimiter | null;
  records: CsvRecord[];
}

const SAMPLE_CHARS = 16_384;
const SAMPLE_RECORDS = 10;
const SINGLE_COLUMN = "\u0000";

const isFilled = (record: CsvRecord): boolean =>
  record.cells.some((cell) => cell.trim() !== "");

interface QuotedField {
  value: string;
  end: number;
  lines: number;
}

const endsLine = (text: string, index: number): boolean =>
  text[index] === "\r" || (text[index] === "\n" && text[index - 1] !== "\r");

function quotedField(text: string, start: number): QuotedField {
  let value = "";
  let lines = 0;
  let index = start;
  for (; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      break;
    } else {
      if (endsLine(text, index)) lines += 1;
      value += char;
    }
  }
  return { value, end: index, lines };
}

function tokenize(text: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let startLine = 1;

  const endCell = () => {
    cells.push(cell.replace(/\r\n?/g, "\n"));
    cell = "";
  };
  const endRecord = () => {
    endCell();
    records.push({ line: startLine, cells });
    cells = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && cell === "") {
      const field = quotedField(text, index + 1);
      cell = field.value;
      line += field.lines;
      index = field.end;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRecord();
      line += 1;
      startLine = line;
    } else {
      cell += char;
    }
  }
  if (cell !== "" || cells.length > 0) endRecord();
  return records;
}

function sampleOf(text: string, delimiter: Delimiter): CsvRecord[] {
  const truncated = text.length > SAMPLE_CHARS;
  const sampled = tokenize(text.slice(0, SAMPLE_CHARS), delimiter).filter(
    isFilled,
  );
  return (truncated ? sampled.slice(0, -1) : sampled).slice(0, SAMPLE_RECORDS);
}

function headerWidth(records: readonly CsvRecord[]): number {
  const cells = records[0]?.cells ?? [];
  return cells.length >= 2 && cells.some(namesKeyword) ? cells.length : 0;
}

function consistentWidth(records: readonly CsvRecord[]): number {
  const widths = records.map((record) => record.cells.length);
  const width = widths[0] ?? 0;
  return width >= 2 && widths.every((entry) => entry === width) ? width : 0;
}

function widest(
  samples: ReadonlyArray<readonly [Delimiter, CsvRecord[]]>,
  widthOf: (records: readonly CsvRecord[]) => number,
): Delimiter | null {
  let best: Delimiter | null = null;
  let bestWidth = 0;
  for (const [delimiter, records] of samples) {
    const width = widthOf(records);
    if (width > bestWidth) {
      best = delimiter;
      bestWidth = width;
    }
  }
  return best;
}

function detectDelimiter(text: string): Delimiter | null {
  const samples = DELIMITERS.map(
    (delimiter) => [delimiter, sampleOf(text, delimiter)] as const,
  );
  return widest(samples, headerWidth) ?? widest(samples, consistentWidth);
}

export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const records = tokenize(text, delimiter ?? SINGLE_COLUMN).filter(isFilled);
  return { delimiter, records };
}
