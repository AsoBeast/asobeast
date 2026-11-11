let remembered: HTMLElement | null = null;

export function rememberSerpOpener(opener: HTMLElement | null): void {
  remembered = opener;
}

export function serpOpenerFor(keywordId: string): HTMLElement | null {
  const opener = remembered;
  return opener?.isConnected && opener.dataset.serpKeyword === keywordId
    ? opener
    : document.querySelector<HTMLElement>(
        `[data-serp-keyword="${CSS.escape(keywordId)}"]`,
      );
}
