export function appVersionLabel(): string | null {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  return version ? `v${version}` : null;
}
