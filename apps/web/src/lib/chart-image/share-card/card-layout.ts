export const CARD_SIZE_NAMES = ["landscape", "square", "portrait"] as const;

export type CardSizeName = (typeof CARD_SIZE_NAMES)[number];

export const CARD_SIZES: Record<
  CardSizeName,
  { width: number; height: number; label: string }
> = {
  landscape: { width: 1200, height: 675, label: "16:9" },
  square: { width: 1080, height: 1080, label: "1:1" },
  portrait: { width: 1080, height: 1350, label: "4:5" },
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
  | "trail"
  | "change"
  | "axis"
  | "chip"
  | "credit"
  | "tick";

export interface CardLayout {
  width: number;
  height: number;
  unit: number;
  margin: number;
  stroke: number;
  dot: number;
  fonts: Record<CardFontRole, number>;
  header: CardBox | null;
  icon: CardBox | null;
  name: CardBox | null;
  store: CardBox | null;
  headline: CardBox;
  lead: CardBox;
  figure: CardBox;
  change: CardBox | null;
  chart: CardBox;
  footer: CardBox;
  mark: CardBox;
  credit: CardBox;
}

const UNITS_ACROSS = 40;
const MARGIN_UNITS = 2;
const ICON_UNITS = 2;
const MARK_UNITS = 1.2;
const LINE_HEIGHT = 1.3;
const STROKE_UNITS = 0.17;
const DOT_UNITS = 0.3;
const FIGURE_LINE_HEIGHT = 1.15;

const FONT_UNITS: Record<CardFontRole, number> = {
  name: 0.8,
  store: 0.6,
  lead: 0.8,
  figure: 2.4,
  trail: 1,
  change: 0.8,
  axis: 0.6,
  chip: 0.7,
  credit: 0.6,
  tick: 0.5,
};

const box = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
});

function fontsFor(unit: number): Record<CardFontRole, number> {
  return {
    name: FONT_UNITS.name * unit,
    store: FONT_UNITS.store * unit,
    lead: FONT_UNITS.lead * unit,
    figure: FONT_UNITS.figure * unit,
    trail: FONT_UNITS.trail * unit,
    change: FONT_UNITS.change * unit,
    axis: FONT_UNITS.axis * unit,
    chip: FONT_UNITS.chip * unit,
    credit: FONT_UNITS.credit * unit,
    tick: FONT_UNITS.tick * unit,
  };
}

function headerBoxes(margin: number, inner: number, unit: number) {
  const size = ICON_UNITS * unit;
  const textX = margin + size + Math.round(unit * 0.6);
  const textWidth = margin + inner - textX;
  return {
    header: box(margin, margin, inner, size),
    icon: box(margin, margin, size, size),
    name: box(textX, margin, textWidth, size / 2),
    store: box(textX, margin + size / 2, textWidth, size / 2),
  };
}

function footerBoxes(
  margin: number,
  inner: number,
  unit: number,
  bottom: number,
) {
  const size = Math.round(MARK_UNITS * unit);
  const y = bottom - size;
  const creditX = margin + size + Math.round(unit * 0.4);
  return {
    footer: box(margin, y, inner, size),
    mark: box(margin, y, size, size),
    credit: box(creditX, y, margin + inner - creditX, size),
  };
}

const NO_HEADER = { header: null, icon: null, name: null, store: null };

export function cardLayout(size: CardSizeName, parts: CardParts): CardLayout {
  const { width, height } = CARD_SIZES[size];
  const unit = Math.round(width / UNITS_ACROSS);
  const margin = MARGIN_UNITS * unit;
  const inner = width - 2 * margin;
  const gap = Math.round(unit / 2);
  const fonts = fontsFor(unit);
  const lineOf = (role: CardFontRole) => Math.round(fonts[role] * LINE_HEIGHT);

  const header = parts.app ? headerBoxes(margin, inner, unit) : NO_HEADER;
  const top = header.header ? margin + header.header.height + unit : margin;
  const lead = box(margin, top, inner, lineOf("lead"));
  const figure = box(
    margin,
    lead.y + lead.height,
    inner,
    Math.round(fonts.figure * FIGURE_LINE_HEIGHT),
  );
  const change = parts.change
    ? box(margin, figure.y + figure.height, inner, lineOf("change"))
    : null;
  const headlineBottom = change
    ? change.y + change.height
    : figure.y + figure.height;

  const footer = footerBoxes(margin, inner, unit, height - margin);
  const chartTop = headlineBottom + unit;

  return {
    width,
    height,
    unit,
    margin,
    stroke: Math.round(unit * STROKE_UNITS),
    dot: Math.round(unit * DOT_UNITS),
    fonts,
    ...header,
    headline: box(margin, top, inner, headlineBottom - top),
    lead,
    figure,
    change,
    chart: box(margin, chartTop, inner, footer.footer.y - gap - chartTop),
    ...footer,
  };
}
