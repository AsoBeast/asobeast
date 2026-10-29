export type PngWriter = (png: Promise<Blob>) => Promise<void>;

export type ShareOutcome = "copied" | "downloaded";

export function browserPngWriter(): PngWriter | null {
  if (
    typeof ClipboardItem === "undefined" ||
    typeof navigator === "undefined" ||
    typeof navigator.clipboard?.write !== "function"
  ) {
    return null;
  }
  return (png) =>
    navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

export async function copyOrDownload(
  png: Promise<Blob>,
  writer: PngWriter | null,
  download: (blob: Blob) => void,
): Promise<ShareOutcome> {
  const copied = writer
    ? await writer(png).then(
        () => true,
        () => false,
      )
    : false;
  if (copied) return "copied";
  download(await png);
  return "downloaded";
}
