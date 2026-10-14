const URL_CREDENTIALS = /([a-z0-9+.-]{1,32}:\/\/)[^\s/@:]+:[^\s/@]+@/gi;

export function redactUrlCredentials(text: string, censor: string): string {
  return text.replace(URL_CREDENTIALS, `$1${censor}@`);
}
