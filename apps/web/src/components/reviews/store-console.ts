import type { Store } from "@asobeast/shared";

const PLAY_CONSOLE = "https://play.google.com/console/";

export function consoleHref(store: Store, storeAppId: string): string {
  return store === "APP_STORE"
    ? `https://appstoreconnect.apple.com/apps/${storeAppId}/distribution/activity/ios/ratingsResponses`
    : PLAY_CONSOLE;
}

export function consoleLabel(store: Store): string {
  return store === "APP_STORE" ? "App Store Connect" : "Play Console";
}
