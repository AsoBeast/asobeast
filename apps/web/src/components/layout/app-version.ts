const RELEASES_URL = "https://github.com/AsoBeast/asobeast/releases/tag/";

export function appVersionLabel(): string | null {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  return version ? `v${version}` : null;
}

export function releaseNotesUrl(label: string): string {
  return `${RELEASES_URL}${label}`;
}
