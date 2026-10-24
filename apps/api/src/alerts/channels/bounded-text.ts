const TRAILING_HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

export function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(TRAILING_HIGH_SURROGATE, '')}…`;
}

export function shortenLine(text: string, max: number): string {
  if (text.length <= max) return text;
  let visible = Math.max(0, max - 24);
  let suffix = '';
  for (;;) {
    suffix = `… (+${text.length - visible} chars omitted)`;
    const next = Math.max(0, max - suffix.length);
    if (next === visible) break;
    visible = next;
  }
  return `${text.slice(0, visible)}${suffix}`;
}

export function boundedLines(lines: string[], max: number): string {
  if (lines.length === 0) return '';
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = shortenLine(lines[index], max);
    const remaining = lines.length - index - 1;
    const note = remaining > 0 ? `+${remaining} more` : '';
    const candidate = [...output, line, note].filter(Boolean).join('\n');
    if (candidate.length <= max) {
      output.push(line);
      continue;
    }
    if (output.length === 0) {
      const available = note ? max - note.length - 1 : max;
      output.push(shortenLine(line, available));
      if (note) output.push(note);
      break;
    }
    const omission = `+${lines.length - index} more`;
    if ([...output, omission].join('\n').length <= max) output.push(omission);
    break;
  }
  return output.join('\n');
}
