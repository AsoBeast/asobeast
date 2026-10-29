import { resolveCssVariables, type VariableLookup } from "./css-variables";
import { inlineStyleText } from "./inline-style";

const SURFACE_SELECTOR = "svg.recharts-surface";
const LEGEND_SELECTOR = ".recharts-legend-wrapper";
const TRANSIENT_SELECTOR = ".recharts-tooltip-cursor, .recharts-active-dot";
const DRAWING_LINE_SELECTOR = ".recharts-line-curve[stroke-dasharray*='px']";

export interface ChartSvg {
  markup: string;
  width: number;
  height: number;
}

export function chartSurface(container: Element): SVGSVGElement {
  const surface = container.querySelector(SURFACE_SELECTOR);
  if (!(surface instanceof SVGSVGElement)) {
    throw new Error("The chart has no drawing to export");
  }
  return surface;
}

export const linesDrawingIn = (container: Element): boolean =>
  container.querySelector(DRAWING_LINE_SELECTOR) !== null;

export function variableLookup(source: Element): VariableLookup {
  const computed = getComputedStyle(source);
  return (name) => {
    const value = computed.getPropertyValue(name).trim();
    return value === "" ? null : value;
  };
}

function legendHeight(container: Element): number {
  const legend = container.querySelector(LEGEND_SELECTOR);
  return legend instanceof HTMLElement ? legend.offsetHeight : 0;
}

function resolveAttributes(element: Element, lookup: VariableLookup): void {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.value.includes("var(")) {
      element.setAttribute(
        attribute.name,
        resolveCssVariables(attribute.value, lookup),
      );
    }
  }
}

function inlineStyles(original: Element, copy: Element): void {
  const computed = getComputedStyle(original);
  const inline = inlineStyleText((property) =>
    computed.getPropertyValue(property),
  );
  const own = copy.getAttribute("style");
  copy.setAttribute("style", [inline, own].filter(Boolean).join(";"));
  copy.removeAttribute("class");
}

export function snapshotChartSvg(container: Element, scale: number): ChartSvg {
  const source = chartSurface(container);
  const clone = source.cloneNode(true);
  if (!(clone instanceof SVGSVGElement)) {
    throw new Error("The chart drawing could not be copied");
  }
  const lookup = variableLookup(container);
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  const transient: Element[] = [];
  originals.forEach((original, index) => {
    const copy = copies[index];
    if (!copy) return;
    resolveAttributes(copy, lookup);
    inlineStyles(original, copy);
    if (original.matches(TRANSIENT_SELECTOR)) transient.push(copy);
  });
  transient.forEach((copy) => copy.remove());

  const box = source.viewBox.baseVal;
  const width = box.width;
  const height = box.height - legendHeight(container);
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("width", String(width * scale));
  clone.setAttribute("height", String(height * scale));
  return {
    markup: new XMLSerializer().serializeToString(clone),
    width,
    height,
  };
}
