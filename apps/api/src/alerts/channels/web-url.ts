export const isWebUrl = (url: string | null): url is string =>
  url !== null && /^https?:\/\//.test(url);
