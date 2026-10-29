import { describe, expect, it, vi } from "vitest";
import { copyOrDownload, type PngWriter } from "./clipboard";

const png = () => Promise.resolve(new Blob(["png"], { type: "image/png" }));

describe("copyOrDownload", () => {
  it("copies and does not download when the writer accepts the image", async () => {
    const writer = vi.fn<PngWriter>().mockResolvedValue(undefined);
    const download = vi.fn();
    const pending = png();

    await expect(copyOrDownload(pending, writer, download)).resolves.toBe(
      "copied",
    );

    expect(writer).toHaveBeenCalledWith(pending);
    expect(download).not.toHaveBeenCalled();
  });

  it("hands the promise to the writer before the image is ready", () => {
    const writer = vi.fn<PngWriter>().mockResolvedValue(undefined);
    const never = new Promise<Blob>(() => undefined);

    void copyOrDownload(never, writer, vi.fn());

    expect(writer).toHaveBeenCalledTimes(1);
  });

  it("downloads the same image when the writer refuses", async () => {
    const writer = vi.fn<PngWriter>().mockRejectedValue(new Error("denied"));
    const download = vi.fn();

    await expect(copyOrDownload(png(), writer, download)).resolves.toBe(
      "downloaded",
    );

    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
  });

  it("downloads when the browser has no image clipboard", async () => {
    const download = vi.fn();

    await expect(copyOrDownload(png(), null, download)).resolves.toBe(
      "downloaded",
    );

    expect(download).toHaveBeenCalledTimes(1);
  });

  it("rejects when the image cannot be drawn and downloads nothing", async () => {
    const failure = new Error("draw failed");
    const writer = vi.fn<PngWriter>().mockRejectedValue(failure);
    const download = vi.fn();
    const broken = Promise.reject(failure);

    await expect(copyOrDownload(broken, writer, download)).rejects.toBe(
      failure,
    );
    await expect(
      copyOrDownload(Promise.reject(failure), null, download),
    ).rejects.toBe(failure);

    expect(download).not.toHaveBeenCalled();
  });
});
