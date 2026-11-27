import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError, { GLOBAL_ERROR_LOCALE_SCRIPT } from "./global-error";

const render = (digest?: string) =>
  renderToStaticMarkup(
    <GlobalError
      error={Object.assign(new Error("boom"), { digest })}
      retry={() => undefined}
    />,
  );

function selectLocale({
  lang = "",
  cookie = "",
  languages = ["en-US"],
  language = "en-US",
}: {
  lang?: string;
  cookie?: string;
  languages?: string[];
  language?: string;
}) {
  const root = { lang, dataset: {} as Record<string, string> };
  const document = {
    cookie,
    documentElement: root,
    title: "",
  };
  const navigator = { languages, language };

  runInNewContext(GLOBAL_ERROR_LOCALE_SCRIPT, { document, navigator });

  return { root, document };
}

describe("the global error page", () => {
  it("draws its own document with a heading, a sentence and one action", () => {
    const html = render();

    expect(html).toContain("<html>");
    expect(html).not.toContain("<title>");
    expect(html).toContain(
      '<h1 data-error-locale="en">Something went wrong</h1>',
    );
    expect(html).toContain("AsoBeast could not render this page.");
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('<span data-error-locale="en">Try again</span>');
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
    expect(render("836429522")).toContain("参考编号 836429522");
  });

  it("shows no reference for an error without one or one that carries an api answer", () => {
    expect(render()).not.toContain("Reference");
    expect(render()).not.toContain("参考编号");
    expect(render("ASOBEAST_API_ERROR;500;;;1")).not.toContain("Reference");
    expect(render("ASOBEAST_API_ERROR;500;;;1")).not.toContain("参考编号");
  });

  it("server-renders both registered locale copies for pre-paint selection", () => {
    const html = render();

    expect(html).toContain('<h1 data-error-locale="zh-CN">出了点问题</h1>');
    expect(html).toContain(
      '<p data-error-locale="zh-CN">AsoBeast 无法渲染此页面。重试通常可以解决临时故障。</p>',
    );
    expect(html).toContain('<span data-error-locale="zh-CN">重试</span>');
    expect(html).toContain('"asobeast_locale"');
    expect(html).toContain("navigator.languages");
    expect(html).toContain("navigator.language");
    expect(html).toContain("localeForTag");
    expect(html).toContain("dataset.errorLocale");
    expect(html).toContain(
      ':root[data-error-locale="en"] [data-error-locale="zh-CN"]',
    );
    expect(html).toContain(
      ':root[data-error-locale="zh-CN"] [data-error-locale="en"]',
    );
    expect(html).toContain(
      ':root:not([data-error-locale]) [data-error-locale="zh-CN"]',
    );
  });

  it("selects a valid document language before the cookie and browser", () => {
    const chinese = selectLocale({
      lang: "zh-CN",
      cookie: "asobeast_locale=en",
      languages: ["en-US"],
    });
    const english = selectLocale({
      lang: "en",
      cookie: "asobeast_locale=zh-CN",
      languages: ["zh-CN"],
    });

    expect(chinese.root.lang).toBe("zh-CN");
    expect(chinese.root.dataset.errorLocale).toBe("zh-CN");
    expect(chinese.document.title).toBe("出了点问题 · AsoBeast");
    expect(english.root.lang).toBe("en");
    expect(english.document.title).toBe("Something went wrong · AsoBeast");
  });

  it("selects the cookie locale when the document language is not valid", () => {
    const chinese = selectLocale({
      lang: "zh-Hant",
      cookie: "theme=dark; asobeast_locale=zh-CN",
      languages: ["en-US"],
    });
    const english = selectLocale({
      cookie: "asobeast_locale=en",
      languages: ["zh-CN"],
    });

    expect(chinese.root.lang).toBe("zh-CN");
    expect(chinese.document.title).toBe("出了点问题 · AsoBeast");
    expect(english.root.lang).toBe("en");
    expect(english.document.title).toBe("Something went wrong · AsoBeast");
  });

  it("selects browser-language-resolved Chinese without a cookie", () => {
    const { root, document } = selectLocale({
      cookie: "theme=dark",
      languages: ["fr-FR", "zh-Hans"],
      language: "fr-FR",
    });

    expect(root.lang).toBe("zh-CN");
    expect(root.dataset.errorLocale).toBe("zh-CN");
    expect(document.title).toBe("出了点问题 · AsoBeast");
  });

  it("falls back to navigator.language when languages is empty", () => {
    const { root } = selectLocale({
      languages: [],
      language: "zh-CN",
    });

    expect(root.lang).toBe("zh-CN");
  });

  it("keeps English as the default for unsupported preferences", () => {
    const { root, document } = selectLocale({
      lang: "zh-Hant",
      cookie: "asobeast_locale=zh-TW",
      languages: ["zh-TW", "fr-FR"],
      language: "ja",
    });

    expect(root.lang).toBe("en");
    expect(root.dataset.errorLocale).toBe("en");
    expect(document.title).toBe("Something went wrong · AsoBeast");
  });
});
