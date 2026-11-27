export const KEYWORD_MENU_ATTRIBUTE = "data-keyword-menu";

export const SUGGESTIONS_TOGGLE_ID = "keyword-suggestions-toggle";

interface IdeasHeading {
  element: HTMLElement;
  seed: string;
}

let opener: HTMLElement | null = null;
let openerKey: string | null = null;
let openedSeed: string | null = null;
let focusFor: string | null = null;
let heading: IdeasHeading | null = null;

export function rememberIdeasOpener(
  element: HTMLElement | null,
  seed: string,
): void {
  opener = element;
  openerKey = element?.getAttribute(KEYWORD_MENU_ATTRIBUTE) ?? null;
  openedSeed = seed;
  focusFor = null;
}

export function requestIdeasFocus(): void {
  if (heading?.seed === openedSeed && heading.element.isConnected) {
    heading.element.focus();
    return;
  }
  focusFor = openedSeed;
}

export function registerIdeasHeading(
  element: HTMLElement,
  seed: string,
): () => void {
  heading = { element, seed };
  if (focusFor === seed) {
    focusFor = null;
    element.focus();
  }
  return () => {
    if (heading?.element === element) heading = null;
  };
}

export function ideasCloseTarget(): HTMLElement | null {
  return (
    releaseIdeasOpener() ??
    document.querySelector<HTMLElement>(`button[${KEYWORD_MENU_ATTRIBUTE}]`) ??
    document.getElementById(SUGGESTIONS_TOGGLE_ID)
  );
}

function releaseIdeasOpener(): HTMLElement | null {
  const rebuilt =
    openerKey === null
      ? null
      : document.querySelector<HTMLElement>(
          `button[${KEYWORD_MENU_ATTRIBUTE}="${CSS.escape(openerKey)}"]`,
        );
  const released = opener?.isConnected ? opener : rebuilt;
  opener = null;
  openerKey = null;
  openedSeed = null;
  focusFor = null;
  return released;
}
