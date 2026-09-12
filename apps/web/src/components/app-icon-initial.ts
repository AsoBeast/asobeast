const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function appIconInitial(name: string | null): string {
  const [first] = graphemes.segment((name ?? "").trim());
  return (first?.segment ?? "?").toUpperCase();
}
