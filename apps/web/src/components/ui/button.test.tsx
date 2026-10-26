import * as React from "react";
import { Slot } from "radix-ui";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

const inner = (button: React.ReactElement) =>
  renderToString(button).replace(/^<button[^>]*>|<\/button>$/g, "");

const Spinner = () => <svg data-testid="spinner" />;

const SPINNER = '<svg data-testid="spinner"></svg>';

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
    expect(inner(choose(true))).toBe(`${SPINNER}<span>Choose Indie</span>`);
    expect(inner(choose(false))).toBe("<span>Choose Indie</span>");
  });

  it("joins adjacent text and numbers into one text node", () => {
    const count = 3;

    expect(inner(<Button>Add {count} keywords</Button>)).toBe(
      "<span>Add 3 keywords</span>",
    );
  });

  it("reads across a slot that renders nothing", () => {
    const label = (plural: boolean) => (
      <Button>Add keyword{plural && "s"} now</Button>
    );

    expect(inner(label(false))).toBe("<span>Add keyword now</span>");
    expect(inner(label(true))).toBe("<span>Add keywords now</span>");
  });

  it("starts a new span after an element", () => {
    expect(
      inner(
        <Button>
          Save
          <Spinner /> changes
        </Button>,
      ),
    ).toBe(`<span>Save</span>${SPINNER}<span> changes</span>`);
  });

  it("wraps the text inside fragments and nested arrays", () => {
    expect(
      inner(
        <Button>
          <>
            <Spinner />
            Track
          </>
        </Button>,
      ),
    ).toBe(`${SPINNER}<span>Track</span>`);
    expect(
      inner(
        <Button>
          <Spinner />
          {["Track ", 2, " more"]}
        </Button>,
      ),
    ).toBe(`${SPINNER}<span>Track 2 more</span>`);
  });

  it("leaves elements, empty text and spacing as they are", () => {
    expect(
      inner(
        <Button>
          <Spinner />
          {""} <span className="sr-only">Close</span>
        </Button>,
      ),
    ).toBe(`${SPINNER} <span class="sr-only">Close</span>`);
  });

  it("gives a button or slotted child without children none", () => {
    const Fallback = ({ children }: { children?: React.ReactNode }) => (
      <span>{children ?? "Fallback"}</span>
    );

    expect(renderToStaticMarkup(<Button aria-label="Close" />)).toMatch(
      /^<button [^>]*><\/button>$/,
    );
    expect(
      renderToStaticMarkup(
        <Button asChild>
          <input aria-label="Name" />
        </Button>,
      ),
    ).toMatch(/^<input [^>]*aria-label="Name"[^>]*\/>$/);
    expect(
      renderToStaticMarkup(
        <Button asChild>
          <Fallback />
        </Button>,
      ),
    ).toMatch(/>Fallback<\/span>$/);
  });

  it("slots through a nested asChild whose child is one element", () => {
    expect(
      renderToStaticMarkup(
        <Button asChild>
          <Slot.Root data-nested="">
            <a href="/upgrade">Upgrade</a>
          </Slot.Root>
        </Button>,
      ),
    ).toMatch(/^<a [^>]*data-nested=""[^>]*>Upgrade<\/a>$/);
  });

  it("hands a render prop child of the slotted child through unchanged", () => {
    const Greeting = ({
      children,
    }: {
      children: (name: string) => React.ReactNode;
    }) => <span>{children("Indie")}</span>;

    expect(
      renderToStaticMarkup(
        <Button asChild>
          <Greeting>{(name) => `Choose ${name}`}</Greeting>
        </Button>,
      ),
    ).toMatch(/>Choose Indie<\/span>$/);
  });

  it("keys a label span the same whether a prefix before it renders", () => {
    const labelKey = (prefixed: boolean) => {
      const children: React.ReactNode[] = Button({
        children: [prefixed && "Track ", "selected"],
      }).props.children;
      return children.find((child) => React.isValidElement(child))?.key;
    };

    expect(labelKey(true)).toBe(labelKey(false));
  });

  it("puts the label of the slotted child of asChild in a span", () => {
    expect(
      renderToStaticMarkup(
        <Button asChild>
          <a href="/upgrade">
            <Spinner />
            Upgrade
          </a>
        </Button>,
      ),
    ).toMatch(
      /^<a [^>]*href="\/upgrade"[^>]*><svg data-testid="spinner"><\/svg><span>Upgrade<\/span><\/a>$/,
    );
  });
});
