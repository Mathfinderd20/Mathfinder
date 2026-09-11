import type {
  CharacterBuild,
  DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import type { SpellSuggestionChoice } from "./buildSuggestions";

export type SpellSeedMode = "prepared" | "known" | "library";
export interface SpellLibraryPlan {
  classKey: string;
  level: number;
  spells: string[];
  mode: SpellSeedMode;
}
export type SpellSeedPlan = SpellLibraryPlan;
export interface SpellSeedGroup extends Omit<SpellSeedPlan, "spells"> {
  className: string;
  capacity: number;
  suggestions: SpellSuggestionChoice[];
}
export type SpellSeedSelections = Record<string, true>;
const normalize = (name: string) => name.trim().toLowerCase();
const unique = (names: string[]) => {
  const seen = new Set<string>();
  return names
    .map((name) => name.trim())
    .filter((name) => {
      const key = normalize(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
export const spellSeedKey = (
  classKey: string,
  level: number,
  spellName: string,
) => `${classKey}:${level}:${spellName}`;

function rankSpells(
  names: string[],
  choices: SpellSuggestionChoice[],
  className: string,
  level: number,
) {
  const ranked = new Map(
    choices.map((choice) => [normalize(choice.spellName), choice]),
  );
  return unique(names)
    .map(
      (name) =>
        ranked.get(normalize(name)) ?? {
          spellName: name,
          reason: `Available ${className} level ${level} spell.`,
          score: 0,
        },
    )
    .sort(
      (a, b) => b.score - a.score || a.spellName.localeCompare(b.spellName),
    );
}

/** Remaining known-spell choices, from the entire available catalog. */
export function buildSpellSeedGroups(
  casters: DerivedSpellcasting[],
  spellChoices: Record<
    string,
    Partial<Record<number, SpellSuggestionChoice[]>>
  >,
): SpellSeedGroup[] {
  return casters
    .filter((caster) => caster.castingType === "spontaneous")
    .flatMap((caster) => {
      const classKey = normalize(caster.className);
      return Object.entries(caster.baseSpellsPerDay).flatMap(([levelText]) => {
        const level = Number(levelText);
        const diagnostic = caster.selectionDiagnostics[level];
        const owned = new Set(
          (caster.selectedKnownSpells[level] ?? []).map(normalize),
        );
        const capacity = Math.max(
          0,
          (caster.spellsKnown[level] ?? 0) - owned.size,
        );
        if (!diagnostic || capacity === 0) return [];
        return [
          {
            classKey,
            className: caster.className,
            mode: "known" as const,
            level,
            capacity,
            suggestions: rankSpells(
              diagnostic.availableSpellNames.filter(
                (name) => !owned.has(normalize(name)),
              ),
              spellChoices[classKey]?.[level] ?? [],
              caster.className,
              level,
            ),
          },
        ];
      });
    });
}

export function buildSpellSeedPlans(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
): SpellSeedPlan[] {
  return groups.flatMap((group) => {
    const spells = group.suggestions
      .filter(
        (entry) =>
          selections[
            spellSeedKey(group.classKey, group.level, entry.spellName)
          ],
      )
      .map((entry) => entry.spellName);
    return spells.length
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
export function selectedSpellCount(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
) {
  return buildSpellSeedPlans(groups, selections).reduce(
    (total, plan) => total + plan.spells.length,
    0,
  );
}
export function spellSeedSelectionsAreComplete(
  groups: SpellSeedGroup[],
  selections: SpellSeedSelections,
) {
  return groups.every(
    (group) => selectedSpellCount([group], selections) === group.capacity,
  );
}

export function buildSpellbookGrantGroups(
  caster: DerivedSpellcasting,
  spellChoices: Partial<Record<number, SpellSuggestionChoice[]>>,
): SpellSeedGroup[] {
  if (caster.spellAccess !== "spellbook") return [];
  const classKey = normalize(caster.className);
  return Object.keys(caster.baseSpellsPerDay).flatMap((levelText) => {
    const level = Number(levelText);
    const diagnostic = caster.selectionDiagnostics[level];
    if (!diagnostic?.canCastLevel || level <= 0) return [];
    const owned = new Set(
      [
        ...(caster.librarySpells[level] ?? []),
        ...(caster.selectedPreparedSpells[level] ?? []),
      ].map(normalize),
    );
    const suggestions = rankSpells(
      diagnostic.availableSpellNames.filter(
        (name) => !owned.has(normalize(name)),
      ),
      spellChoices[level] ?? [],
      caster.className,
      level,
    );
    return suggestions.length
      ? [
          {
            classKey,
            className: caster.className,
            mode: "library" as const,
            level,
            capacity: 2,
            suggestions,
          },
        ]
      : [];
  });
}
export const buildSpellbookGrantPlans = buildSpellSeedPlans;

/** Starting books and known spells use the same operations as later advances. */
export function buildStartingSpellPlans(
  build: Pick<CharacterBuild, "spellLibrary" | "spellSelections">,
  casters: DerivedSpellcasting[],
): SpellLibraryPlan[] {
  return casters.flatMap((caster) => {
    const classKey = normalize(caster.className);
    const plans: SpellLibraryPlan[] = [];
    if (caster.spellAccess === "spellbook")
      for (const [level, spells] of Object.entries(
        build.spellLibrary?.[classKey] ?? {},
      )) {
        if (spells?.length)
          plans.push({
            classKey,
            level: Number(level),
            mode: "library",
            spells,
          });
      }
    for (const mode of ["known", "prepared"] as const)
      for (const [level, spells] of Object.entries(
        build.spellSelections?.[classKey]?.[mode] ?? {},
      )) {
        if (spells?.length)
          plans.push({ classKey, level: Number(level), mode, spells });
      }
    return plans;
  });
}

/** Applies additions atomically. Preparation never acquires a spell. */
export function applySpellSeedPlans(
  build: CharacterBuild,
  plans: SpellLibraryPlan[],
  casters: DerivedSpellcasting[],
): CharacterBuild {
  let next = build;
  const ordered = [
    ...plans.filter((plan) => plan.mode !== "prepared"),
    ...plans.filter((plan) => plan.mode === "prepared"),
  ];
  for (const plan of ordered) {
    const classKey = normalize(plan.classKey);
    const caster = casters.find(
      (entry) => normalize(entry.className) === classKey,
    );
    const diagnostic = caster?.selectionDiagnostics[plan.level];
    if (!caster || !diagnostic || !(plan.level in caster.baseSpellsPerDay))
      throw new Error(
        "Spell choices must belong to an unlocked casting class and level.",
      );
    const names = plan.spells.map((name) => name.trim()).filter(Boolean);
    const library = next.spellLibrary?.[classKey]?.[plan.level] ?? [];
    const available = new Set(
      [
        ...diagnostic.availableSpellNames,
        ...(caster.grantedSpells?.[plan.level] ?? []),
        ...library,
      ].map(normalize),
    );
    if (names.some((name) => !available.has(normalize(name))))
      throw new Error(
        `Choose available ${caster.className} level ${plan.level} spells.`,
      );
    if (plan.mode === "library") {
      if (caster.spellAccess !== "spellbook")
        throw new Error("Only spellbook acquisitions belong in this grant.");
      next = {
        ...next,
        spellLibrary: {
          ...next.spellLibrary,
          [classKey]: {
            ...next.spellLibrary?.[classKey],
            [plan.level]: unique([
              ...library,
              ...(next.spellSelections?.[classKey]?.prepared?.[plan.level] ??
                []),
              ...names,
            ]),
          },
        },
      };
      continue;
    }
    if ((plan.mode === "known") !== (caster.castingType === "spontaneous"))
      throw new Error("Spell selection mode does not match the class.");
    const prior =
      next.spellSelections?.[classKey]?.[plan.mode]?.[plan.level] ?? [];
    const selections =
      plan.mode === "known"
        ? unique([...prior, ...names])
        : [...prior, ...names];
    const capacity =
      plan.mode === "known"
        ? (caster.spellsKnown[plan.level] ?? 0)
        : diagnostic.capacity;
    if (selections.length > capacity)
      throw new Error(
        `${caster.className} level ${plan.level} spell choices exceed the available allowance.`,
      );
    if (plan.mode === "prepared") {
      const owned = new Set(
        [
          ...diagnostic.librarySpellNames,
          ...library,
          ...(caster.grantedSpells?.[plan.level] ?? []),
          ...prior,
        ].map(normalize),
      );
      if (names.some((name) => !owned.has(normalize(name))))
        throw new Error("Acquire spellbook spells before preparing them.");
    }
    next = {
      ...next,
      ...(plan.mode === "known"
        ? {
            spellLibrary: {
              ...next.spellLibrary,
              [classKey]: {
                ...next.spellLibrary?.[classKey],
                [plan.level]: unique([...library, ...prior, ...names]),
              },
            },
          }
        : {}),
      spellSelections: {
        ...next.spellSelections,
        [classKey]: {
          ...next.spellSelections?.[classKey],
          [plan.mode]: {
            ...next.spellSelections?.[classKey]?.[plan.mode],
            [plan.level]: selections,
          },
        },
      },
    };
  }
  return next;
}
