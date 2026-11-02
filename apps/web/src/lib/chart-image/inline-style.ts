export const INLINED_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stop-color",
  "stop-opacity",
  "opacity",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "font-variant-numeric",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
] as const;

export function inlineStyleText(read: (property: string) => string): string {
  return INLINED_PROPERTIES.flatMap((property) => {
    const value = read(property).trim();
    return value === "" ? [] : [`${property}:${value}`];
  }).join(";");
}
