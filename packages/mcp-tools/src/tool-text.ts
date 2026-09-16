export function toolText(data: unknown): string {
  return JSON.stringify(data) ?? "null";
}
