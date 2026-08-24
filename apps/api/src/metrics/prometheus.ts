export interface MetricSample {
  labels?: Record<string, string>;
  value: number;
}

export interface MetricFamily {
  name: string;
  help: string;
  samples: MetricSample[];
}

export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

export function renderMetrics(families: readonly MetricFamily[]): string {
  return families
    .filter((family) => family.samples.length > 0)
    .map(renderFamily)
    .join('\n')
    .concat('\n');
}

function renderFamily(family: MetricFamily): string {
  const lines = [
    `# HELP ${family.name} ${escapeHelp(family.help)}`,
    `# TYPE ${family.name} gauge`,
    ...family.samples.map((sample) => renderSample(family.name, sample)),
  ];
  return lines.join('\n');
}

function renderSample(name: string, sample: MetricSample): string {
  const labels = Object.entries(sample.labels ?? {});
  const rendered = labels
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(',');
  const selector = rendered.length > 0 ? `{${rendered}}` : '';
  return `${name}${selector} ${format(sample.value)}`;
}

function format(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

function escapeHelp(help: string): string {
  return help.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}
