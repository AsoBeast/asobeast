import type * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select, SelectTrigger, SelectValue } from "./select";

const valueOf = (select: React.ReactElement) =>
  /<span data-slot="select-value"[^>]*>(.*?)<\/span><svg/.exec(
    renderToString(select),
  )?.[1];

describe("SelectValue", () => {
  it("keeps a placeholder in its own span", () => {
    expect(
      valueOf(
        <Select>
          <SelectTrigger aria-label="App">
            <SelectValue placeholder="Choose an app" />
          </SelectTrigger>
        </Select>,
      ),
    ).toBe("<span>Choose an app</span>");
  });

  it("joins the text of explicit children into one span", () => {
    const country = "United Kingdom";

    expect(
      valueOf(
        <Select value="gb">
          <SelectTrigger aria-label="Market">
            <SelectValue>
              {country} ({"gb"})
            </SelectValue>
          </SelectTrigger>
        </Select>,
      ),
    ).toBe("<span>United Kingdom (gb)</span>");
  });

  it("leaves the value to the chosen item when it has no children", () => {
    expect(
      valueOf(
        <Select value="gb">
          <SelectTrigger aria-label="Market">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      ),
    ).toBe("");
  });
});
