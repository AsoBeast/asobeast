let opener: HTMLElement | null = null;
let openerKey: string | null = null;
let heading: HTMLElement | null = null;
let focusPending = false;

export function rememberIdeasOpener(element: HTMLElement | null): void {
  opener = element;
  openerKey = element?.getAttribute("data-serp-keyword") ?? null;
  focusPending = false;
}

export function requestIdeasFocus(): void {
  if (heading?.isConnected) {
    heading.focus();
    return;
  }
  focusPending = true;
}

export function registerIdeasHeading(element: HTMLElement | null): void {
  heading = element;
  if (element && focusPending) {
    focusPending = false;
    element.focus();
  }
}

export function releaseIdeasOpener(): HTMLElement | null {
  const rebuilt =
    openerKey === null
      ? null
      : document.querySelector<HTMLElement>(
          `button[data-serp-keyword="${CSS.escape(openerKey)}"]`,
        );
  const released = opener?.isConnected ? opener : rebuilt;
  opener = null;
  openerKey = null;
  focusPending = false;
  return released;
}
