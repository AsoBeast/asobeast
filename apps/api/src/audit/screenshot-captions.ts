interface Settled {
  status: string;
  caption: string | null;
}

export function readCaptionTexts(
  screenshots: readonly Settled[],
): string[] | null {
  const settled = screenshots.filter(
    (item) => item.status === 'read' || item.status === 'blank',
  );
  if (settled.length === 0) return null;
  return settled.flatMap((item) =>
    item.caption === null ? [] : [item.caption],
  );
}
