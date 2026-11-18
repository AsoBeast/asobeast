import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError from "./global-error";

const render = (digest?: string) =>
  renderToStaticMarkup(
    <GlobalError
      error={Object.assign(new Error("boom"), { digest })}
      retry={() => undefined}
    />,
  );

describe("the global error page", () => {
  it("draws its own document with a heading, a sentence and one action", () => {
    const html = render();

    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<h1>Something went wrong</h1>");
    expect(html).toContain("AsoBeast could not render this page.");
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("Try again");
  });

  it("carries the token colours of both schemes without a stylesheet", () => {
    const html = render();

    expect(html).toContain("--page: #faf9f7");
    expect(html).toContain("--page: #0c0b0a");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain('[data-theme="dark"]');
    expect(html).not.toContain('rel="stylesheet"');
  });

  it("names the reference of an error the server stamped", () => {
    expect(render("836429522")).toContain("Reference 836429522");
  });

  it("shows no reference for an error without one or one that carries an api answer", () => {
    expect(render()).not.toContain("Reference");
    expect(render("ASOBEAST_API_ERROR;500;;;1")).not.toContain("Reference");
  });
});
