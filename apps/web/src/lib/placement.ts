import {
  KEYWORD_MIN_RELEVANCE,
  type PlacementSuggestion,
  type PlacementSuggestionField,
} from "@asobeast/shared";
import { grade, GRADE_SCALES, gradeLabel, type GradeMetric } from "./grade";

export const PLACEMENT_LABELS: Record<PlacementSuggestionField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywordField: "Keyword field",
  shortDescription: "Short description",
  description: "Description",
  skip: "Skip",
};

export interface PlacementFigure {
  metric: GradeMetric;
  label: string;
  value: number;
  shown: string;
}

export type PlacementPart = string | PlacementFigure;

const POOR_POPULARITY = GRADE_SCALES.popularity.cuts[2];
const REACHABLE_POSITION = GRADE_SCALES.position.cuts[2];

const figure = (
  metric: GradeMetric,
  label: string,
  value: number,
  shown = String(Math.round(value)),
): PlacementFigure => ({ metric, label, value, shown });

const capitalized = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

function strongField({
  reason,
  popularity,
  difficulty,
  position,
}: PlacementSuggestion): PlacementPart[] {
  const where = `belongs in ${reason === "strongestReachable" ? "the title" : "the subtitle"}.`;
  const popularityGrade = grade("popularity", popularity);
  if (popularity === null || popularityGrade === null) {
    return [capitalized(where)];
  }
  const lead = `${capitalized(gradeLabel(popularityGrade))} popularity `;
  const popular = figure("popularity", "Popularity", popularity);
  if (position !== null) {
    return [
      lead,
      popular,
      ", you rank ",
      figure("position", "Position", position, `#${position}`),
      `: ${where}`,
    ];
  }
  if (difficulty !== null) {
    return [
      lead,
      popular,
      " at difficulty ",
      figure("difficulty", "Difficulty", difficulty),
      `: ${where}`,
    ];
  }
  return [lead, popular, `: ${where}`];
}

function hardToRank({
  popularity,
  difficulty,
}: PlacementSuggestion): PlacementPart[] {
  const tail = ` and you have no recent rank in the top ${REACHABLE_POSITION}: index it in the keyword field.`;
  if (popularity === null || difficulty === null) {
    return [
      `You have no recent rank in the top ${REACHABLE_POSITION}: index it in the keyword field.`,
    ];
  }
  return [
    "Difficulty ",
    figure("difficulty", "Difficulty", difficulty),
    " is at or above popularity ",
    figure("popularity", "Popularity", popularity),
    tail,
  ];
}

function lowPopularity({ popularity }: PlacementSuggestion): PlacementPart[] {
  if (popularity === null || popularity >= POOR_POPULARITY) {
    return ["Popularity is under the official floor: not worth a field yet."];
  }
  return [
    "Popularity ",
    figure("popularity", "Popularity", popularity),
    ` is under ${POOR_POPULARITY}: not worth a field yet.`,
  ];
}

function lowRelevance(relevance: number | null): PlacementPart[] {
  const tail = ` is under ${KEYWORD_MIN_RELEVANCE}: it does not describe your app well enough.`;
  if (relevance === null) return [`Relevance${tail}`];
  return ["Relevance ", figure("relevance", "Relevance", relevance), tail];
}

export function placementSentence(
  suggestion: PlacementSuggestion,
  relevance: number | null,
): PlacementPart[] {
  switch (suggestion.reason) {
    case "strongestReachable":
    case "nextReachable":
      return strongField(suggestion);
    case "hardToRank":
      return hardToRank(suggestion);
    case "singleWord":
      return [
        "A single word: the keyword field indexes it without spending title room.",
      ];
    case "longTail":
      return [
        "A long tail phrase: the keyword field is enough to be found for it.",
      ];
    case "noStrongRoom":
      return [
        "The title and subtitle are taken by stronger keywords: index it in the keyword field.",
      ];
    case "noRoom":
      return ["The keyword field has no room left for it."];
    case "lowPopularity":
      return lowPopularity(suggestion);
    case "lowRelevance":
      return lowRelevance(relevance);
    case "competitorBrand":
      return [
        "Another app's brand: store policy keeps it out of your listing.",
      ];
    case "ownBrand":
      return ["Your title already makes your own name searchable."];
  }
}
