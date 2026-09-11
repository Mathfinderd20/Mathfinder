import type {
  CharacterBuild,
  DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import type { SpellSuggestionChoice } from "./buildSuggestions";

export type SpellSeedMode = "prepared" | "known";

export interface SpellLibraryPlan {
  classKey: string;
  level: number;
  spells: string[];
  mode?: SpellSeedMode;
}

export interface SpellSeedPlan extends SpellLibraryPlan {
  mode: SpellSeedMode;
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

export function classFeaturesIncludeSpellbook(
  features: Array<{ name: string }> | undefined,
) {
  return (
    features?.some((feature) => /^spellbooks?$/i.test(feature.name.trim())) ??
    false
  );
}

export function buildSpellbookGrantGroups(
  caster: DerivedSpellcasting,
  spellChoices: Partial<Record<number, SpellSuggestionChoice[]>>,
): SpellSeedGroup[] {
  const classKey = caster.className.trim().toLowerCase();
  return Object.entries(caster.selectionDiagnostics).flatMap(
    ([levelText, diagnostic]) => {
      const level = Number(levelText);
      if (!diagnostic || level <= 0 || !diagnostic.canCastLevel) return [];
      const owned = new Set(
        [
          ...(caster.librarySpells[level] ?? []),
          ...(caster.selectedPreparedSpells[level] ?? []),
          ...(caster.selectedKnownSpells[level] ?? []),
        ].map((name) => name.trim().toLowerCase()),
      );
      const suggestions = spellChoices[level] ?? [];
      const suggestedByName = new Map(
        suggestions.map((choice) => [choice.spellName.toLowerCase(), choice]),
      );
      const available = diagnostic.availableSpellNames
        .filter((name) => !owned.has(name.trim().toLowerCase()))
        .map(
          (name): SpellSuggestionChoice =>
            suggestedByName.get(name.toLowerCase()) ?? {
              spellName: name,
              reason: `Available ${caster.className} level ${level} spell.`,
              score: 0,
            },
        )
        .sort(
          (a, b) => b.score - a.score || a.spellName.localeCompare(b.spellName),
        );
      return available.length > 0
        ? [
            {
              classKey,
              className: caster.className,
              mode: "prepared" as const,
              level,
              capacity: 2,
              suggestions: available,
            },
          ]
        : [];
    },
  );
}

export function selectedSpellCount(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
) {
  return groups.reduce(
    (count, group) =>
      count +
      group.suggestions.filter((entry) =>
        Boolean(
          selections[
            spellSeedKey(group.classKey, group.level, entry.spellName)
          ],
        ),
      ).length,
    0,
  );
}

export function buildSpellbookGrantPlans(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
): SpellLibraryPlan[] {
  return groups.flatMap((group) => {
    const spells = group.suggestions
      .filter((entry) =>
        Boolean(
          selections[
            spellSeedKey(group.classKey, group.level, entry.spellName)
          ],
        ),
      )
      .map((entry) => entry.spellName);
    return spells.length > 0
      ? [{ classKey: group.classKey, level: group.level, spells }]
      : [];
  });
}

export function applySpellSeedPlans(
  build: CharacterBuild,
  plans: SpellLibraryPlan[],
) {
  return plans.reduce<CharacterBuild>((seeded, plan) => {
    const library = seeded.spellLibrary?.[plan.classKey]?.[plan.level] ?? [];
    const nextLibrary = [...library];
    for (const spellName of plan.spells)
      if (!nextLibrary.includes(spellName)) nextLibrary.push(spellName);
    const withLibrary: CharacterBuild = {
      ...seeded,
      spellLibrary: {
        ...(seeded.spellLibrary ?? {}),
        [plan.classKey]: {
          ...((seeded.spellLibrary ?? {})[plan.classKey] ?? {}),
          [plan.level]: nextLibrary,
        },
      },
    };
    if (!plan.mode) return withLibrary;
    return {
      ...withLibrary,
      spellSelections: {
        ...(withLibrary.spellSelections ?? {}),
        [plan.classKey]: {
          ...((withLibrary.spellSelections ?? {})[plan.classKey] ?? {}),
          [plan.mode]: {
            ...((withLibrary.spellSelections ?? {})[plan.classKey]?.[
              plan.mode
            ] ?? {}),
            [plan.level]: plan.spells,
          },
        },
      },
    };
  }, build);
}
