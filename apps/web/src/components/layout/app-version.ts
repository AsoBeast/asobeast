export const RELEASES_URL = "https://github.com/AsoBeast/asobeast/releases";

export function appVersion(): string | null {
  return process.env.NEXT_PUBLIC_APP_VERSION || null;
}

export function appVersionLabel(): string | null {
  const version = appVersion();
  return version ? `v${version}` : null;
}

export function releaseNotesUrl(label: string): string {
  return `${RELEASES_URL}/tag/${label}`;
}
