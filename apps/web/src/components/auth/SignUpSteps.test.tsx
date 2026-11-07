import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { signUpSteps } from "@/lib/sign-up-steps";
import { SignUpSteps } from "./SignUpSteps";

const TAG = /<(\/?)([a-z]+)([^>]*?)(\/?)>|([^<]+)/g;

function spokenText(markup: string): string[] {
  const items: string[] = [];
  let hiddenDepth = 0;
  let current: string | null = null;
  for (const [
    ,
    closing,
    name,
    attributes,
    selfClosing,
    text,
  ] of markup.matchAll(TAG)) {
    if (text !== undefined) {
      if (current !== null && hiddenDepth === 0) current += text;
      continue;
    }
    if (selfClosing) continue;
    if (closing) {
      if (hiddenDepth > 0) hiddenDepth -= 1;
      else if (name === "li" && current !== null) {
        items.push(current.trim());
        current = null;
      }
      continue;
    }
    if (hiddenDepth > 0 || attributes?.includes('aria-hidden="true"')) {
      hiddenDepth += 1;
      continue;
    }
    if (name === "li") current = "";
  }
  return items;
}

describe("SignUpSteps", () => {
  it("tells a finished step from an upcoming one without the hidden marks", () => {
    const markup = renderToStaticMarkup(
      <SignUpSteps
        steps={signUpSteps({
          entryStep: "confirm-email",
          emailVerified: false,
        })}
      />,
    );

    expect(spokenText(markup)).toEqual([
      "Account created (completed)",
      "Email confirmed",
      "Choose a plan (not started)",
    ]);
    expect(markup).toContain('<span class="sr-only"> (completed)</span>');
    expect(markup).toContain('<span class="sr-only"> (not started)</span>');
  });
});
