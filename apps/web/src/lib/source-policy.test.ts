import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const chartPath = new URL("../components/ui/chart.tsx", import.meta.url);
const registerPath = new URL(
  "../components/auth/RegisterForm.tsx",
  import.meta.url,
);

function parse(path: URL): ts.SourceFile {
  const source = readFileSync(path, "utf8");
  return ts.createSourceFile(
    path.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function countAssertions(node: ts.Node): number {
  let count = ts.isAsExpression(node) ? 1 : 0;
  node.forEachChild((child) => {
    count += countAssertions(child);
  });
  return count;
}

function countComments(source: ts.SourceFile): number {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    source.text,
  );
  let count = 0;
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      count += 1;
    }
  }
  return count;
}

describe("web source policy", () => {
  it("keeps the chart free of comments and type assertions", () => {
    const chart = parse(chartPath);
    expect(countComments(chart)).toBe(0);
    expect(countAssertions(chart)).toBe(0);
  });

  it("keeps registration navigation cache-driven", () => {
    const register = readFileSync(registerPath, "utf8");
    expect(register).not.toContain("router.refresh(");
  });
});
