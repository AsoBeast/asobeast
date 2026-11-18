import { describe, expect, it } from "vitest";
import {
  selectionScope,
  tickedIn,
  trackingSelectedMessage,
  trackSelectedLabel,
  withoutTicks,
  withTick,
} from "./suggestion-selection";

describe("trackSelectedLabel", () => {
  it("names the selection it would track", () => {
    expect(trackSelectedLabel(0)).toBe("Track selected");
    expect(trackSelectedLabel(1)).toBe("Track 1 selected");
    expect(trackSelectedLabel(3)).toBe("Track 3 selected");
  });
});

describe("trackingSelectedMessage", () => {
  it("counts the keywords and promises positions", () => {
    expect(trackingSelectedMessage(1)).toBe(
      "Tracking 1 keyword. Positions arrive within minutes.",
    );
    expect(trackingSelectedMessage(3)).toBe(
      "Tracking 3 keywords. Positions arrive within minutes.",
    );
  });
});

describe("withTick", () => {
  it("adds and removes a text without touching the set it was given", () => {
    const start = new Set(["focus"]);
    expect([...withTick(start, "timer", true)]).toEqual(["focus", "timer"]);
    expect([...withTick(start, "focus", false)]).toEqual([]);
    expect([...start]).toEqual(["focus"]);
  });
});

describe("tickedIn", () => {
  const shown = ["deep focus", "pomodoro timer", "study sessions"];
  const scope = selectionScope("us", "metadata");

  it("answers the ticks made in the scope on screen, in list order", () => {
    const selection = {
      scope,
      texts: new Set(["study sessions", "deep focus"]),
    };
    expect(tickedIn(selection, scope, shown, new Set())).toEqual([
      "deep focus",
      "study sessions",
    ]);
  });

  it("drops every tick once the market or the source changes", () => {
    const selection = { scope, texts: new Set(["deep focus"]) };
    expect(
      tickedIn(selection, selectionScope("gb", "metadata"), shown, new Set()),
    ).toEqual([]);
    expect(
      tickedIn(selection, selectionScope("us", "search"), shown, new Set()),
    ).toEqual([]);
  });

  it("keeps a phrase ticked while a request ran when it removes the sent ones", () => {
    const selection = {
      scope,
      texts: new Set(["deep focus", "pomodoro timer", "study sessions"]),
    };
    const after = withoutTicks(
      selection,
      ["deep focus", "pomodoro timer"],
      scope,
    );
    expect(after.scope).toBe(scope);
    expect([...after.texts]).toEqual(["study sessions"]);
  });

  it("keeps the ticks of another market when a request sent elsewhere succeeds", () => {
    const selection = {
      scope: selectionScope("gb", "metadata"),
      texts: new Set(["deep focus"]),
    };
    expect(withoutTicks(selection, ["deep focus"], scope)).toBe(selection);
  });

  it("leaves out a phrase that is tracked now or no longer listed", () => {
    const selection = {
      scope,
      texts: new Set(["deep focus", "pomodoro timer", "gone phrase"]),
    };
    expect(
      tickedIn(selection, scope, shown, new Set(["pomodoro timer"])),
    ).toEqual(["deep focus"]);
  });
});
