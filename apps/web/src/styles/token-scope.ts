export type Scope = Record<string, string>;

export function declarations(css: string, selector: string): Scope {
  const body = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(
    css,
  )?.[1];
  if (body === undefined) throw new Error(`no ${selector} block found`);
  const scope: Scope = {};
  for (const [, name = "", value = ""] of body.matchAll(
    /(--[\w-]+):\s*([^;]+);/g,
  )) {
    scope[name] = value.replace(/\s+/g, " ").trim();
  }
  return scope;
}

export function resolve(token: string, scope: Scope): string {
  let value = scope[token];
  for (let depth = 0; value?.includes("var(") && depth < 10; depth += 1) {
    let missing = false;
    value = value.replace(/var\((--[\w-]+)\)/g, (_reference, name: string) => {
      const nested = scope[name];
      if (nested === undefined) missing = true;
      return nested ?? "";
    });
    if (missing) return "";
  }
  return value ?? "";
}
