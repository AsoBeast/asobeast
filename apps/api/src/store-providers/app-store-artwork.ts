const ICON_SIZE = 300;

export function resolvedArtworkUrl(template: string): string {
  return template
    .replaceAll('{w}', String(ICON_SIZE))
    .replaceAll('{h}', String(ICON_SIZE))
    .replaceAll('{c}', 'bb')
    .replaceAll('{f}', 'jpg');
}
