import type { WorkspaceChecklist } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceChecklist,
  updateWorkspaceChecklist,
} from "./workspace-checklist";

const CHECKLIST: WorkspaceChecklist = {
  goal: "use_with_ai",
  dismissedAt: null,
  items: [
    { id: "import_app", title: "Import an app", done: true, appId: "app-1" },
  ],
  done: 1,
  total: 1,
};

interface Sent {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), init });
    return Promise.resolve(
      new Response(JSON.stringify(CHECKLIST), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the workspace checklist transport", () => {
  it("reads the checklist", async () => {
    const sent = stubFetch();

    await expect(getWorkspaceChecklist()).resolves.toEqual(CHECKLIST);

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toMatch(/\/workspace\/checklist$/);
    expect(sent[0].init?.method ?? "GET").toBe("GET");
  });

  it("patches the goal and answers the saved checklist", async () => {
    const sent = stubFetch();

    await expect(
      updateWorkspaceChecklist({ goal: "use_with_ai" }),
    ).resolves.toEqual(CHECKLIST);

    expect(sent[0].url).toMatch(/\/workspace\/checklist$/);
    expect(sent[0].init?.method).toBe("PATCH");
    expect(JSON.parse(String(sent[0].init?.body))).toEqual({
      goal: "use_with_ai",
    });
    expect(new Headers(sent[0].init?.headers).get("content-type")).toBe(
      "application/json",
    );
  });
});
