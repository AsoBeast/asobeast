import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

const inner = (button: React.ReactElement) =>
  renderToStaticMarkup(button).replace(/^<button[^>]*>|<\/button>$/g, "");

const Spinner = () => <svg data-testid="spinner" />;

const choose = (pending: boolean) => (
  <Button>
    {pending ? <Spinner /> : null}
    Choose Indie
  </Button>
);

describe("Button", () => {
  it("puts a plain label in a span", () => {
    expect(inner(<Button>Save</Button>)).toBe("<span>Save</span>");
  });

  it("keeps the label in its own span beside a pending spinner", () => {
    expect(inner(choose(true))).toBe(
      '<svg data-testid="spinner"></svg><span>Choose Indie</span>',
    );
    expect(inner(choose(false))).toBe("<span>Choose Indie</span>");
  });

  it("joins adjacent text and numbers into one string in one span", () => {
    const count = 3;
    const label = (
      Button({ children: ["Add ", count, " keywords"] }).props as {
        children: React.ReactElement<{ children: unknown }>[];
      }
    ).children;

    expect(label).toHaveLength(3);
    expect(label[0]?.props.children).toBe("Add 3 keywords");
    expect(label.slice(1)).toEqual([null, null]);
  });

  it("starts a new span after an empty slot", () => {
    const suffix = (dirty: boolean) => (
      <Button>Save{dirty ? <Spinner /> : null} changes</Button>
    );

    expect(inner(suffix(false))).toBe("<span>Save</span><span> changes</span>");
    expect(inner(suffix(true))).toBe(
      '<span>Save</span><svg data-testid="spinner"></svg><span> changes</span>',
    );
  });

  it("wraps the text inside a fragment", () => {
    expect(
      inner(
        <Button>
          <>
            <Spinner />
            Track
          </>
        </Button>,
      ),
    ).toBe('<svg data-testid="spinner"></svg><span>Track</span>');
    expect(
      inner(
        <Button>
          <Spinner />
          <>Track</>
        </Button>,
      ),
    ).toBe('<svg data-testid="spinner"></svg><span>Track</span>');
  });

  it("leaves elements and empty text as they are", () => {
    expect(
      inner(
        <Button>
          <Spinner />
          {""}
          <span className="sr-only">Close</span>
        </Button>,
      ),
    ).toBe(
      '<svg data-testid="spinner"></svg><span class="sr-only">Close</span>',
    );
  });

  it("hands the child of asChild to the slot untouched", () => {
    expect(
      renderToStaticMarkup(
        <Button asChild>
          <a href="/upgrade">Upgrade</a>
        </Button>,
      ),
    ).toMatch(/^<a [^>]*href="\/upgrade"[^>]*>Upgrade<\/a>$/);
  });
});
