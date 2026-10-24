export function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_~])/g, '\\$1');
}

export function escapeDiscord(text: string): string {
  return text.replace(/([\\`*_~|>@])/g, '\\$1');
}
