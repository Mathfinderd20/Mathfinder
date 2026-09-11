import type {
  CharacterBuild,
  DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import type { SpellSuggestionChoice } from "./buildSuggestions";

export type SpellSeedMode = "prepared" | "known";

export interface SpellSeedPlan {
  classKey: string;
  mode: SpellSeedMode;
  level: number;
  spells: string[];
}

export interface SpellSeedGroup extends Omit<SpellSeedPlan, "spells"> {
  className: string;
  capacity: number;
  suggestions: SpellSuggestionChoice[];
}

export type SpellSeedSelections = Record<string, true>;

const FULL_CASTER_CLASS_NAMES = new Set([
  "cleric",
  "druid",
  "sorcerer",
  "wizard",
]);

export function isFullCasterClass(className: string) {
  return FULL_CASTER_CLASS_NAMES.has(className.trim().toLowerCase());
}

export function spellSeedKey(
  classKey: string,
  level: number,
  spellName: string,
) {
  return `${classKey}:${level}:${spellName}`;
}

export function buildSpellSeedGroups(
  casters: DerivedSpellcasting[],
  spellChoices: Record<
    string,
    Partial<Record<number, SpellSuggestionChoice[]>>
  >,
  options: { fullCastersOnly?: boolean } = {},
): SpellSeedGroup[] {
  return casters.flatMap((caster) => {
    if (options.fullCastersOnly && !isFullCasterClass(caster.className))
      return [];
    const classKey = caster.className.toLowerCase();
    const mode = caster.castingType === "prepared" ? "prepared" : "known";
    return Object.entries(spellChoices[classKey] ?? {}).flatMap(
      ([levelText, choices]) => {
        const level = Number(levelText);
        const suggestions = (choices ?? []).slice(0, 4);
        const capacity = caster.selectionDiagnostics[level]?.capacity ?? 0;
        if (suggestions.length === 0 || capacity <= 0) return [];
        return [
          {
            classKey,
            className: caster.className,
            mode,
            level,
            capacity,
            suggestions,
          },
        ];
      },
    );
  });
}

export function buildSpellSeedPlans(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
): SpellSeedPlan[] {
  return groups.flatMap((group) => {
    const spells = group.suggestions
      .filter((entry) =>
        Boolean(
          selections[
            spellSeedKey(group.classKey, group.level, entry.spellName)
          ],
        ),
      )
      .map((entry) => entry.spellName)
      .slice(0, group.capacity);
    return spells.length > 0
      ? [
          {
            classKey: group.classKey,
            mode: group.mode,
            level: group.level,
            spells,
          },
        ]
      : [];
  });
}

export function spellSeedSelectionsAreComplete(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
) {
  return groups.every((group) => {
    const selectedCount = group.suggestions.filter((entry) =>
      Boolean(
        selections[spellSeedKey(group.classKey, group.level, entry.spellName)],
      ),
    ).length;
    return selectedCount >= Math.min(group.capacity, group.suggestions.length);
  });
}

export function applySpellSeedPlans(
  build: CharacterBuild,
  plans: SpellSeedPlan[],
) {
  return plans.reduce<CharacterBuild>((seeded, plan) => {
    const library = seeded.spellLibrary?.[plan.classKey]?.[plan.level] ?? [];
    const nextLibrary = [...library];
    for (const spellName of plan.spells)
      if (!nextLibrary.includes(spellName)) nextLibrary.push(spellName);
    return {
      ...seeded,
      spellLibrary: {
        ...(seeded.spellLibrary ?? {}),
        [plan.classKey]: {
          ...((seeded.spellLibrary ?? {})[plan.classKey] ?? {}),
          [plan.level]: nextLibrary,
        },
      },
      spellSelections: {
        ...(seeded.spellSelections ?? {}),
        [plan.classKey]: {
          ...((seeded.spellSelections ?? {})[plan.classKey] ?? {}),
          [plan.mode]: {
            ...((seeded.spellSelections ?? {})[plan.classKey]?.[plan.mode] ??
              {}),
            [plan.level]: plan.spells,
          },
        },
      },
    };
  }, build);
}
