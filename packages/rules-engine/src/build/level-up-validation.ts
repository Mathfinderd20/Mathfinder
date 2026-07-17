import type { SkillKey } from "../types";
import type { LevelUpPlan, LevelUpSelection, ValidationIssue } from "./types";

export function validateLevelUpSelection(
  plan: LevelUpPlan,
  selection: LevelUpSelection,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ranks = Object.values(selection.skillRanks).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  if (ranks > plan.skillPoints) {
    issues.push({
      severity: "error",
      code: "skill-points-over-budget",
      message: `Allocated ${ranks} skill ranks but only ${plan.skillPoints} available.`,
    });
  }
  for (const [key, value] of Object.entries(selection.skillRanks) as [
    SkillKey,
    number,
  ][]) {
    if ((value ?? 0) > 1) {
      issues.push({
        severity: "error",
        code: "skill-ranks-per-level",
        message: `Skill "${key}": at most 1 rank may be added per level.`,
      });
    }
  }
  if (selection.abilityIncrease && !plan.grantsAbilityIncrease) {
    issues.push({
      severity: "error",
      code: "illegal-ability-increase",
      message: `Level ${plan.characterLevel} does not grant an ability score increase.`,
    });
  }
  if (plan.grantsAbilityIncrease && !selection.abilityIncrease) {
    issues.push({
      severity: "warning",
      code: "ability-increase-unspent",
      message: `Level ${plan.characterLevel} grants a +1 ability score increase you have not assigned.`,
    });
  }
  if (plan.grantsFeat && (selection.feats ?? []).length === 0) {
    issues.push({
      severity: "warning",
      code: "feat-unspent",
      message: `Level ${plan.characterLevel} grants a feat you have not chosen.`,
    });
  }
  return issues;
}
