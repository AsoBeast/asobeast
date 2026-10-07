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

function tokenize(text: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
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
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
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

function widthOf(text: string, delimiter: Delimiter): number {
  const truncated = text.length > SAMPLE_CHARS;
  const sampled = tokenize(text.slice(0, SAMPLE_CHARS), delimiter).filter(
    isFilled,
  );
  const records = (truncated ? sampled.slice(0, -1) : sampled).slice(
    0,
    SAMPLE_RECORDS,
  );
  const widths = records.map((record) => record.cells.length);
  const width = widths[0] ?? 0;
  return width >= 2 && widths.every((entry) => entry === width) ? width : 0;
}

function detectDelimiter(text: string): Delimiter | null {
  let best: Delimiter | null = null;
  let bestWidth = 0;
  for (const delimiter of DELIMITERS) {
    const width = widthOf(text, delimiter);
    if (width > bestWidth) {
      best = delimiter;
      bestWidth = width;
    }
  }
  return best;
}

export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const records = tokenize(text, delimiter ?? SINGLE_COLUMN).filter(isFilled);
  return { delimiter, records };
}
