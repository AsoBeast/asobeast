import type {
  ChartEnteredPayload,
  ChartLeftPayload,
  ChartMoveBase,
  ChartMovePayload,
} from '@asobeast/shared';
import { rankMilestone } from '../rankings/rank-milestones';

export interface ChartMoveInput extends ChartMoveBase {
  from: number | null;
  to: number | null;
}

function edgeMove(
  input: ChartMoveInput,
): ChartEnteredPayload | ChartLeftPayload | null {
  const { from, to, ...base } = input;
  if (from === null && to !== null) {
    return { ...base, event: 'chart.entered', from, to };
  }
  if (from !== null && to === null) {
    return { ...base, event: 'chart.left', from, to };
  }
  return null;
}

export function chartMovePayloads(input: ChartMoveInput): ChartMovePayload[] {
  const { from, to, ...base } = input;
  const edge = edgeMove(input);
  const milestone = rankMilestone(from, to);
  return [
    ...(edge ? [edge] : []),
    ...(milestone
      ? [
          {
            ...base,
            event: 'chart.milestone' as const,
            tier: milestone.tier,
            direction: milestone.direction,
            from,
            to,
          },
        ]
      : []),
  ];
}
