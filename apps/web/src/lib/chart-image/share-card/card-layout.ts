export const CARD_SIZE_NAMES = ["landscape", "square", "portrait"] as const;

export type CardSizeName = (typeof CARD_SIZE_NAMES)[number];

export interface CardSize {
  width: number;
  height: number;
  label: string;
  name: string;
}

export const CARD_SIZES: Record<CardSizeName, CardSize> = {
  landscape: { width: 1200, height: 675, label: "16:9", name: "Landscape" },
  square: { width: 1080, height: 1080, label: "1:1", name: "Square" },
  portrait: { width: 1080, height: 1350, label: "4:5", name: "Portrait" },
};

export const isCardSizeName = (value: unknown): value is CardSizeName =>
  CARD_SIZE_NAMES.some((name) => name === value);

export interface CardBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardParts {
  change: boolean;
  app: boolean;
}

export type CardFontRole =
  | "name"
  | "store"
  | "lead"
  | "figure"
  | "change"
  | "tick"
  | "axis"
  | "chip"
  | "credit";

interface CardMetrics {
  frame: number;
  strip: number;
  radius: number;
  padding: number;
  column: number | null;
  icon: number;
  pill: number;
  mark: number;
  stroke: number;
  dot: number;
  fonts: Record<CardFontRole, number>;
}

const METRICS: Record<CardSizeName, CardMetrics> = {
  landscape: {
    frame: 28,
    strip: 72,
    radius: 28,
    padding: 44,
    column: 420,
    icon: 64,
    pill: 46,
    mark: 38,
    stroke: 5,
    dot: 9,
    fonts: {
      name: 26,
      store: 18,
      lead: 24,
      figure: 136,
      change: 24,
      tick: 16,
      axis: 17,
      chip: 20,
      credit: 21,
    },
  },
  square: {
    frame: 32,
    strip: 84,
    radius: 32,
    padding: 52,
    column: null,
    icon: 76,
    pill: 54,
    mark: 44,
    stroke: 6,
    dot: 10,
    fonts: {
      name: 32,
      store: 22,
      lead: 30,
      figure: 184,
      change: 28,
      tick: 18,
      axis: 20,
      chip: 24,
      credit: 25,
    },
  },
  portrait: {
    frame: 32,
    strip: 84,
    radius: 32,
    padding: 52,
    column: null,
    icon: 76,
    pill: 58,
    mark: 44,
    stroke: 6,
    dot: 10,
    fonts: {
      name: 32,
      store: 22,
      lead: 32,
      figure: 208,
      change: 30,
      tick: 18,
      axis: 20,
      chip: 24,
      credit: 25,
    },
  },
};

export interface CardLayout {
  width: number;
  height: number;
  radius: number;
  stroke: number;
  dot: number;
  fonts: Record<CardFontRole, number>;
  panel: CardBox;
  strip: CardBox;
  header: CardBox | null;
  icon: CardBox | null;
  name: CardBox | null;
  store: CardBox | null;
  lead: CardBox;
  figure: CardBox;
  change: CardBox | null;
  chart: CardBox;
  mark: CardBox;
  credit: CardBox;
}

const LINE_HEIGHT = 1.3;
const CAP_HEIGHT = 0.72;
const NAME_GAP = 0.26;
const LEAD_GAP = 0.6;
const FIGURE_GAP = 0.16;
const STRIP_INSET = 8;
const MARK_GAP = 0.3;

const box = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
});

const bottomOf = ({ y, height }: CardBox) => y + height;

const inset = ({ x, y, width, height }: CardBox, by: number) =>
  box(x + by, y + by, width - 2 * by, height - 2 * by);

const NO_HEADER = { header: null, icon: null, name: null, store: null };

function headerBoxes(
  metrics: CardMetrics,
  x: number,
  y: number,
  width: number,
) {
  const size = metrics.icon;
  const textX = x + size + Math.round(size * NAME_GAP);
  const textWidth = x + width - textX;
  return {
    header: box(x, y, width, size),
    icon: box(x, y, size, size),
    name: box(textX, y, textWidth, size / 2),
    store: box(textX, y + size / 2, textWidth, size / 2),
  };
}

function headlineHeight(metrics: CardMetrics, parts: CardParts): number {
  const { fonts } = metrics;
  const text =
    Math.round(fonts.lead * LINE_HEIGHT) +
    Math.round(fonts.lead * LEAD_GAP) +
    Math.round(fonts.figure * CAP_HEIGHT);
  return parts.change
    ? text + Math.round(fonts.figure * FIGURE_GAP) + metrics.pill
    : text;
}

function headlineBoxes(
  metrics: CardMetrics,
  parts: CardParts,
  { x, y, width }: Omit<CardBox, "height">,
) {
  const { fonts } = metrics;
  const lead = box(x, y, width, Math.round(fonts.lead * LINE_HEIGHT));
  const figure = box(
    x,
    bottomOf(lead) + Math.round(fonts.lead * LEAD_GAP),
    width,
    Math.round(fonts.figure * CAP_HEIGHT),
  );
  const change = parts.change
    ? box(
        x,
        bottomOf(figure) + Math.round(fonts.figure * FIGURE_GAP),
        width,
        metrics.pill,
      )
    : null;
  return { lead, figure, change };
}

function creditBoxes(metrics: CardMetrics, strip: CardBox) {
  const size = metrics.mark;
  const mark = box(
    strip.x + STRIP_INSET,
    strip.y + Math.round((strip.height - size) / 2),
    size,
    size,
  );
  const creditX = mark.x + size + Math.round(size * MARK_GAP);
  return {
    mark,
    credit: box(
      creditX,
      mark.y,
      strip.x + strip.width - STRIP_INSET - creditX,
      size,
    ),
  };
}

function splitContent(
  metrics: CardMetrics,
  parts: CardParts,
  content: CardBox,
  column: number,
) {
  const header = parts.app
    ? headerBoxes(metrics, content.x, content.y, column)
    : NO_HEADER;
  const height = headlineHeight(metrics, parts);
  const top = bottomOf(content) - height;
  const chartX = content.x + column + metrics.padding;
  return {
    ...header,
    ...headlineBoxes(metrics, parts, { x: content.x, y: top, width: column }),
    chart: box(
      chartX,
      content.y,
      content.x + content.width - chartX,
      content.height,
    ),
  };
}

function stackedContent(
  metrics: CardMetrics,
  parts: CardParts,
  content: CardBox,
) {
  const header = parts.app
    ? headerBoxes(metrics, content.x, content.y, content.width)
    : NO_HEADER;
  const top = header.header
    ? bottomOf(header.header) + metrics.padding
    : content.y;
  const headline = headlineBoxes(metrics, parts, {
    x: content.x,
    y: top,
    width: content.width,
  });
  const chartTop =
    bottomOf(headline.change ?? headline.figure) + metrics.padding;
  return {
    ...header,
    ...headline,
    chart: box(
      content.x,
      chartTop,
      content.width,
      bottomOf(content) - chartTop,
    ),
  };
}

export function cardLayout(size: CardSizeName, parts: CardParts): CardLayout {
  const { width, height } = CARD_SIZES[size];
  const metrics = METRICS[size];
  const { frame, strip: stripHeight } = metrics;
  const panel = box(
    frame,
    frame,
    width - 2 * frame,
    height - frame - stripHeight,
  );
  const strip = box(frame, bottomOf(panel), panel.width, stripHeight);
  const content = inset(panel, metrics.padding);
  return {
    width,
    height,
    radius: metrics.radius,
    stroke: metrics.stroke,
    dot: metrics.dot,
    fonts: metrics.fonts,
    panel,
    strip,
    ...(metrics.column === null
      ? stackedContent(metrics, parts, content)
      : splitContent(metrics, parts, content, metrics.column)),
    ...creditBoxes(metrics, strip),
  };
}
