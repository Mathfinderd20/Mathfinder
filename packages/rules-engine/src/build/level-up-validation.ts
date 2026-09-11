import type { SkillKey } from "../types";
import type { LevelUpPlan, LevelUpSelection, ValidationIssue } from "./types";

export function validateLevelUpSelection(
  plan: LevelUpPlan,
  selection: LevelUpSelection,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (
    !Number.isInteger(selection.hitPointRoll) ||
    selection.hitPointRoll < 1 ||
    selection.hitPointRoll > plan.hitDie
  ) {
    issues.push({
      severity: "error",
      code: "invalid-hit-point-roll",
      message: `Hit points must be a whole number from 1 to ${plan.hitDie}.`,
    });
  }
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
    if (!Number.isInteger(value) || value < 0 || value > 1) {
      issues.push({
        severity: "error",
        code: "skill-ranks-per-level",
        message: `Skill "${key}": assign either 0 or 1 rank at this level.`,
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
