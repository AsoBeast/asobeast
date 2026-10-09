import {
  activeSeasonalEvents,
  KeywordSuggestion,
  normalizeText,
  SEASONAL_LEAD_DAYS,
  seasonalKeywords,
} from '@asobeast/shared';

export function seasonalSuggestions(
  now: Date,
  country: string,
  trackedTexts: Set<string>,
  limit: number,
): KeywordSuggestion[] {
  const suggestions: KeywordSuggestion[] = [];
  const seen = new Set<string>();
  for (const event of activeSeasonalEvents(now, SEASONAL_LEAD_DAYS, country)) {
    for (const keyword of seasonalKeywords(event, now)) {
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
