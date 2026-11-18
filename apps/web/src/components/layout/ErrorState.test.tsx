import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorState } from "./ErrorState";

function markup(props: Partial<Parameters<typeof ErrorState>[0]>) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ErrorState
        error={new Error("boom")}
        retry={() => undefined}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("ErrorState", () => {
  it("is a bordered panel with a plain title by default", () => {
    const html = markup({});

    expect(html).toContain('role="alert"');
    expect(html).toContain("rounded-lg border");
    expect(html).toContain('<p class="font-medium">Something went wrong</p>');
    expect(html).not.toContain("<h1");
  });

  it("is a centred page with the title as the heading in the page layout", () => {
    const html = markup({ layout: "page", className: "max-w-90" });

    expect(html).toContain('role="alert"');
    expect(html).toContain('<h1 class="text-title">Something went wrong</h1>');
    expect(html).toContain("text-center");
    expect(html).toContain("max-w-90");
    expect(html).not.toContain("rounded-lg border");
  });

  it("keeps the retry action in both layouts", () => {
    expect(markup({})).toContain("Try again");
    expect(markup({ layout: "page" })).toContain("Try again");
  });
});
