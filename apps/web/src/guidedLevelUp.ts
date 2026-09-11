import {
  applyLevelUp,
  type CharacterBuild,
  type DerivedSpellcasting,
  type LevelUpSelection,
} from "@mathfinder/rules-engine";
import {
  applySpellSeedPlans,
  buildSpellbookGrantGroups,
  type SpellLibraryPlan,
} from "./spellSeedPlans";
export type LevelUpSpellSeedPlan = SpellLibraryPlan;
export type LevelUpCastingChoices = Pick<
  CharacterBuild,
  "spellDomains" | "spellSpecializations"
>;

export function withLevelUpCastingChoices(
  build: CharacterBuild,
  className: string,
  choices?: LevelUpCastingChoices,
): CharacterBuild {
  const classKey = className.trim().toLowerCase();
  let next = build;
  for (const field of ["spellDomains", "spellSpecializations"] as const) {
    if (choices?.[field]?.[classKey] !== undefined)
      next = {
        ...next,
        [field]: { ...next[field], [classKey]: choices[field]![classKey] },
      };
  }
  return next;
}

/** Commit the reviewed level, acquisitions and preparations as one immutable update. */
export function applyGuidedLevelUp(
  build: CharacterBuild,
  selection: LevelUpSelection,
  additions: LevelUpSpellSeedPlan[],
  casters: DerivedSpellcasting[],
  languages?: CharacterBuild["languages"],
  castingChoices?: LevelUpCastingChoices,
): CharacterBuild {
  const classKey = selection.className.trim().toLowerCase();
  if (additions.some((plan) => plan.classKey.trim().toLowerCase() !== classKey))
    throw new Error("Only the advanced class can receive level-up spells.");
  const caster = casters.find(
    (entry) => entry.className.toLowerCase() === classKey,
  );
  if (
    caster?.spellAccess === "spellbook" &&
    build.levels.some((level) => level.className.toLowerCase() === classKey)
  ) {
    const eligible = new Set(
      buildSpellbookGrantGroups(caster, {}).flatMap((group) =>
        group.suggestions.map(
          (spell) => `${group.level}:${spell.spellName.trim().toLowerCase()}`,
        ),
      ),
    );
    const acquired = additions
      .filter((plan) => plan.mode === "library")
      .flatMap((plan) =>
        plan.spells.map((name) => `${plan.level}:${name.trim().toLowerCase()}`),
      );
    if (
      acquired.length !== 2 ||
      new Set(acquired).size !== 2 ||
      acquired.some((key) => !eligible.has(key))
    )
      throw new Error("Choose exactly two new, eligible spellbook spells.");
  }
  let next = applyLevelUp(build, selection);
  if (languages) next = { ...next, languages };
  next = withLevelUpCastingChoices(next, classKey, castingChoices);
  return applySpellSeedPlans(next, additions, casters);
}
