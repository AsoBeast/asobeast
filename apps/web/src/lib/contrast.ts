type Linear = [number, number, number];

const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;
const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const decodeSrgb = (channel: number) =>
  channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);

interface Component {
  value: number;
  percent: boolean;
}

const CALL = /^[a-z]+\(([^()]*)\)$/;
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)%?$/;

function components(value: string): Component[] | null {
  const body = CALL.exec(value)?.[1];
  if (body === undefined) return null;
  const tokens = body.split(/[\s,]+/).filter(Boolean);
  if (!tokens.every((token) => NUMBER.test(token))) return null;
  return tokens.map((token) =>
    token.endsWith("%")
      ? { value: Number(token.slice(0, -1)), percent: true }
      : { value: Number(token), percent: false },
  );
}

function opaque(
  parts: Component[] | null,
): parts is [Component, Component, Component] {
  return (
    parts !== null &&
    parts.length === 3 &&
    parts.every((part) => !isNaN(part.value))
  );
}

function fromXyzD50(x: number, y: number, z: number): Linear {
  return [
    clamp(
      3.1341359569958707 * x - 1.6173863321612538 * y - 0.4906619460083532 * z,
    ),
    clamp(
      -0.978795502912089 * x + 1.9161604866331933 * y + 0.03341799940305775 * z,
    ),
    clamp(
      0.07195537988411677 * x - 0.2289768264158322 * y + 1.4053851325266966 * z,
    ),
  ];
}

function fromLab(parts: Component[] | null): Linear | null {
  if (!opaque(parts)) return null;
  const [lightness, aPart, bPart] = parts;
  const l = lightness.value;
  const a = aPart.value;
  const b = bPart.value;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA;
  const y = l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA;
  const z = fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA;
  return fromXyzD50(x * D50[0]!, y * D50[1]!, z * D50[2]!);
}

function fromOklch(parts: Component[] | null): Linear | null {
  if (!opaque(parts)) return null;
  const [l, c, h] = parts;
  const lightness = l.percent ? l.value / 100 : l.value;
  const chroma = c.percent ? (c.value / 100) * 0.4 : c.value;
  const radians = (h.value * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    clamp(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    clamp(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  ];
}

function fromRgb(parts: Component[] | null): Linear | null {
  if (!opaque(parts)) return null;
  const channel = (part: Component) =>
    decodeSrgb(clamp(part.percent ? part.value / 100 : part.value / 255));
  const [red, green, blue] = parts;
  return [channel(red), channel(green), channel(blue)];
}

function fromHex(value: string): Linear | null {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(value)) return null;
  const digits =
    value.length === 4
      ? value
          .slice(1)
          .split("")
          .map((digit) => digit + digit)
      : (value.slice(1).match(/.{2}/g) ?? []);
  return fromRgb(
    digits.map((pair) => ({ value: parseInt(pair, 16), percent: false })),
  );
}

export function toLinear(color: string): Linear | null {
  const value = color.trim().toLowerCase();
  if (value.startsWith("#")) return fromHex(value);
  if (value.startsWith("oklch")) return fromOklch(components(value));
  if (value.startsWith("lab")) return fromLab(components(value));
  if (value.startsWith("rgb")) return fromRgb(components(value));
  return null;
}

export function relativeLuminance(color: string): number | null {
  const linear = toLinear(color);
  if (!linear) return null;
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(
  foreground: string,
  background: string,
): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}
