import * as React from "react";

export type ParentElement = React.ReactElement<{
  children?: React.ReactNode;
  asChild?: boolean;
}>;

const isText = (node: React.ReactNode): node is string | number | bigint =>
  typeof node === "string" ||
  typeof node === "number" ||
  typeof node === "bigint";

export const isAbsent = (node: React.ReactNode): node is null | undefined =>
  node === null || node === undefined;

const rendersNothing = (node: React.ReactNode): boolean =>
  isAbsent(node) || typeof node === "boolean";

const isFragment = (node: React.ReactNode): node is ParentElement =>
  React.isValidElement(node) && node.type === React.Fragment;

type TextRun = { key: string; text: string };

function textRuns(nodes: readonly React.ReactNode[]): Map<number, TextRun> {
  const runs = new Map<number, TextRun>();
  let current: TextRun | null = null;
  for (const [index, node] of nodes.entries()) {
    if (isText(node)) {
      if (current) {
        current.text += String(node);
      } else {
        current = { key: `text-${runs.size}`, text: String(node) };
        runs.set(index, current);
      }
    } else if (!rendersNothing(node)) {
      current = null;
    }
  }
  return runs;
}

const isOpaque = (children: React.ReactNode): boolean =>
  !Array.isArray(children) && !isText(children) && !isFragment(children);

export function textInSpans(children: React.ReactNode): React.ReactNode {
  if (isOpaque(children)) return children;
  const nodes = Array.isArray(children) ? children : [children];
  const runs = textRuns(nodes);
  return nodes.map((node, index) => {
    const run = runs.get(index);
    if (run !== undefined) {
      return run.text.trim() ? <span key={run.key}>{run.text}</span> : run.text;
    }
    if (isText(node)) return null;
    if (Array.isArray(node)) return textInSpans(node);
    if (isFragment(node)) {
      return (
        <React.Fragment key={node.key ?? `fragment-${index}`}>
          {textInSpans(node.props.children)}
        </React.Fragment>
      );
    }
    return node;
  });
}
