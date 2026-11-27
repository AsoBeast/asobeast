import { getImageProps } from "next/image";

const ICON_SIZE = 128;
const LOAD_TIMEOUT_MS = 3000;
const MARK_SRC = "/brand/mark.png";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), LOAD_TIMEOUT_MS),
  );
  const decoded = image.decode().then(
    () => image,
    () => null,
  );
  return Promise.race([decoded, timeout]);
}

function optimizedIconSrc(iconUrl: string): string | null {
  try {
    return getImageProps({
      src: iconUrl,
      alt: "",
      width: ICON_SIZE,
      height: ICON_SIZE,
    }).props.src;
  } catch {
    return null;
  }
}

export async function loadCardIcon(
  iconUrl: string | null,
): Promise<HTMLImageElement | null> {
  const src = iconUrl === null ? null : optimizedIconSrc(iconUrl);
  return src === null ? null : loadImage(src);
}

export const loadCardMark = (): Promise<HTMLImageElement | null> =>
  loadImage(MARK_SRC);
