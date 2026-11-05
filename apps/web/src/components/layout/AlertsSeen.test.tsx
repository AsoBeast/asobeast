import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seenCookie } from "@/lib/alerts-seen";
import { AlertsSeenProvider, useAlertsSeen } from "./AlertsSeen";

const T10 = "2026-11-03T10:00:00.000Z";
const T11 = "2026-11-03T11:00:00.000Z";

function captured(initial: string | null) {
  const seen: ReturnType<typeof useAlertsSeen>[] = [];
  function Reader() {
    const value = useAlertsSeen();
    seen.push(value);
    return <span>{value.seenAt ?? "never"}</span>;
  }
  const markup = renderToStaticMarkup(
    <AlertsSeenProvider initial={initial}>
      <Reader />
    </AlertsSeenProvider>,
  );
  return { markup, value: seen[0] };
}

function stubDocument(cookie = "") {
  const writes: string[] = [];
  const stub = {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      writes.push(value);
    },
  };
  vi.stubGlobal("document", stub);
  return writes;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlertsSeenProvider", () => {
  it("reads no visit on the server without a cookie", () => {
    expect(captured(null).markup).toBe("<span>never</span>");
  });

  it("reads the cookie the layout passed in the first render", () => {
    expect(captured(T10).markup).toBe(`<span>${T10}</span>`);
  });

  it("renders the value the layout passed even when the cookie moved on", () => {
    stubDocument(seenCookie(T11).split(";")[0]);

    expect(captured(T10).markup).toBe(`<span>${T10}</span>`);
  });

  it("never moves back a later visit another tab wrote", () => {
    const writes = stubDocument(seenCookie(T11).split(";")[0]);
    const { markSeen } = captured(null).value;

    markSeen(T10);

    expect(writes).toEqual([]);
  });

  it("writes a later visit and ignores an earlier or unreadable one", () => {
    const writes = stubDocument();
    const { markSeen } = captured(null).value;

    markSeen(T11);
    markSeen(T10);
    markSeen(T11);
    markSeen("yesterday");

    expect(writes).toEqual([seenCookie(T11)]);
  });

  it("refuses a reader without a provider", () => {
    function Lonely() {
      useAlertsSeen();
      return null;
    }
    expect(() => renderToStaticMarkup(<Lonely />)).toThrow(
      "AlertsSeenProvider",
    );
  });
});
