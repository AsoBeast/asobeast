import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppDetail } from "@asobeast/shared";
import { DelistedNotice } from "./DelistedNotice";

const SINCE = "2026-10-20T23:59:00.000Z";

const detail = (over: Partial<AppDetail> = {}): AppDetail => ({
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "471112395",
  country: "de",
  name: "Gone",
  iconUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  searchable: true,
  latestSnapshot: null,
  competitors: [],
  group: null,
  isCompetitor: false,
  delistedAt: SINCE,
  ...over,
});

const text = (app: AppDetail) =>
  renderToStaticMarkup(<DelistedNotice detail={app} since={SINCE} />).replace(
    /<[^>]+>/g,
    "",
  );

describe("DelistedNotice", () => {
  it("names the store, the store id, the storefront and the UTC day", () => {
    expect(text(detail())).toContain(
      "No longer listed on App StoreSince Oct 20, 2026, App Store answers that it has no app 471112395 in Germany.",
    );
  });

  it("names Google Play for a Play app", () => {
    expect(
      text(detail({ store: "GOOGLE_PLAY", storeAppId: "com.example.gone" })),
    ).toContain("Google Play answers that it has no app com.example.gone");
  });

  it("sends an app to the dashboard and a competitor to its app", () => {
    expect(text(detail())).toContain("delete it from the dashboard.");
    expect(text(detail({ isCompetitor: true }))).toContain(
      "remove it from the competitors of the app that tracks it.",
    );
  });
});
