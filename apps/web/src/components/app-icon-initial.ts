export function appIconInitial(name: string | null): string {
  return ([...(name ?? "").trim()][0] ?? "?").toUpperCase();
}
