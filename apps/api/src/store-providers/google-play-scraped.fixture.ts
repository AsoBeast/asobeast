import { NotFoundError } from '@mradex77/google-play-scraper';

export const playAppNotFound = (appId: string): NotFoundError =>
  new NotFoundError(
    'App not found (404)',
    404,
    `https://play.google.com/store/apps/details?id=${appId}`,
  );
