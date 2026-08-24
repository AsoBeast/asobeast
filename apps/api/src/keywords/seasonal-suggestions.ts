import {
  activeSeasonalEvents,
  KeywordSuggestion,
  normalizeText,
  SEASONAL_LEAD_DAYS,
} from '@asobeast/shared';

export function seasonalSuggestions(
  now: Date,
  trackedTexts: Set<string>,
  limit: number,
): KeywordSuggestion[] {
  const suggestions: KeywordSuggestion[] = [];
  const seen = new Set<string>();
  for (const event of activeSeasonalEvents(now, SEASONAL_LEAD_DAYS)) {
    for (const keyword of event.keywords) {
      const text = normalizeText(keyword);
      if (!text || trackedTexts.has(text) || seen.has(text)) {
        continue;
      }
      seen.add(text);
      suggestions.push({ text, strategy: 'seasonal', event: event.name });
      if (suggestions.length >= limit) {
        return suggestions;
      }
    }
  }
  return suggestions;
}
