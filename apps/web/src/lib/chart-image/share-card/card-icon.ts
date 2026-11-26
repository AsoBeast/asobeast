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

export function loadCardIcon(
  iconUrl: string | null,
): Promise<HTMLImageElement | null> {
  if (iconUrl === null) return Promise.resolve(null);
  const { props } = getImageProps({
    src: iconUrl,
    alt: "",
    width: ICON_SIZE,
    height: ICON_SIZE,
  });
  return loadImage(props.src);
}

export const loadCardMark = (): Promise<HTMLImageElement | null> =>
  loadImage(MARK_SRC);
