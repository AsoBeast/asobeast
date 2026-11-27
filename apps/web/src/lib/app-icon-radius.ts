const MIN_ICON_RADIUS = 4;
const ICON_RADIUS_RATIO = 0.225;

export const iconRadius = (size: number) =>
  Math.max(MIN_ICON_RADIUS, Math.round(size * ICON_RADIUS_RATIO));
