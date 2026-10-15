import {
  APP_RUN_STAGES,
  type AppRunStage,
  type AppRunStageStatus,
} from '@asobeast/shared';

export interface StageCount {
  ready: number;
  total: number;
}

export type AppRunCounts = Record<AppRunStage, StageCount>;

export function appRunStages(counts: AppRunCounts): AppRunStageStatus[] {
  return APP_RUN_STAGES.map((stage) => {
    const total = counts[stage].total;
    const ready = Math.min(counts[stage].ready, total);
    return { stage, ready, total, complete: ready >= total };
  });
}
