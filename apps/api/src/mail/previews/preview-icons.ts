import type {
  AlertBatchAppSection,
  AlertBatchPayload,
  AlertPayload,
} from '@asobeast/shared';

export const PREVIEW_ICON =
  'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b9/12/90/b91290a5-8300-d039-794b-15c4892b9e98/AppIcon-0-0-1x_U007epad-0-10-0-85-220.png/512x512bb.jpg';

export const PREVIEW_PREVIOUS_ICON =
  'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/97/4d/85/974d8537-a749-63ec-1a79-416270bf3c44/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg';

const withIcon = <T extends { iconUrl?: string | null }>(app: T): T => ({
  ...app,
  iconUrl: PREVIEW_ICON,
});

const sectionWithIcons = (
  section: AlertBatchAppSection,
): AlertBatchAppSection => ({
  ...section,
  app: withIcon(section.app),
  competitors: section.competitors.map((competitor) => ({
    ...competitor,
    app: { ...competitor.app, iconUrl: PREVIEW_PREVIOUS_ICON },
  })),
});

export function withPreviewIcons(
  payload: AlertBatchPayload,
): AlertBatchPayload {
  return { ...payload, apps: payload.apps.map(sectionWithIcons) };
}

export function withPreviewIdentity<
  T extends Exclude<AlertPayload, AlertBatchPayload>,
>(payload: T): T {
  if (!('app' in payload)) return payload;
  return {
    ...payload,
    app: {
      iconUrl: PREVIEW_ICON,
      store: 'APP_STORE',
      country: 'us',
      ...payload.app,
    },
  };
}
