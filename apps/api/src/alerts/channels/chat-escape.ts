export function escapeSlack(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function slackName(name: string): string {
  return escapeSlack(name.replace(/[*_~]/g, ''));
}

export function escapeDiscord(text: string): string {
  return text.replace(/([\\`*_~|<>@[\]])/g, '\\$1');
}
