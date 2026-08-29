export interface PlannerExpansion {
  previousCount: number;
  targetCount: number;
}

export function plannerRollbackCount(
  currentLevel: number,
  levelIndex: number,
  expansion: PlannerExpansion | null,
) {
  const expandedFrom =
    expansion?.targetCount === levelIndex + 1
      ? expansion.previousCount
      : levelIndex;
  return Math.max(currentLevel, expandedFrom);
}
