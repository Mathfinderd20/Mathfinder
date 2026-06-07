import { modifiersFor, resolveModifiers } from "./modifiers";
import type {
  AbilityKey,
  CharacterInput,
  DerivedAbility,
} from "./types";

const ABILITY_KEYS: readonly AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Pathfinder ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Resolve effective ability scores and modifiers. Ability-targeting modifiers
 * (racial adjustments, enhancement belts, inherent tomes, etc.) are applied
 * with the normal stacking rules before the modifier is computed.
 */
export function deriveAbilities(
  input: CharacterInput,
): Record<AbilityKey, DerivedAbility> {
  const result = {} as Record<AbilityKey, DerivedAbility>;

  for (const key of ABILITY_KEYS) {
    const base = input.abilityScores[key];
    const resolved = resolveModifiers(modifiersFor(input.modifiers, key));
    const score = base + resolved.total;

    const breakdown = [
      { source: "base", type: "base", value: base },
      ...resolved.contributing.map((m) => ({
        source: m.source,
        type: m.type,
        value: m.value,
      })),
    ];

    result[key] = { score, mod: abilityModifier(score), breakdown };
  }

  return result;
}

export { ABILITY_LABEL };
