import type {
  AbilityKey,
  CharacterInput,
  DerivedSpellcasting,
  DerivedStat,
  SpellcastingEntry,
} from "./types";
import type { DerivedAbility } from "./types";

function stat(total: number): DerivedStat {
  return {
    total,
    breakdown: [{ source: "spellcasting", type: "untyped", value: total }],
  };
}

function maxSpellLevelFromSlots(spellsPerDay: Partial<Record<number, number>>): number {
  const levels = Object.entries(spellsPerDay)
    .filter(([, slots]) => (slots ?? 0) > 0)
    .map(([level]) => Number(level));
  return levels.length > 0 ? Math.max(...levels) : 0;
}

export function spellSaveDc(castingAbilityMod: number, spellLevel: number): number {
  return 10 + spellLevel + castingAbilityMod;
}

export function deriveSpellcasting(
  input: CharacterInput,
  abilities: Record<AbilityKey, DerivedAbility>,
): DerivedSpellcasting[] {
  const entries = input.spellcasting ?? [];
  return entries.map((entry: SpellcastingEntry) => {
    const ability = abilities[entry.castingAbility];
    const abilityMod = ability.mod;
    const concentration = stat(entry.casterLevel + abilityMod);
    const maxSpellLevel = maxSpellLevelFromSlots(entry.spellsPerDay);
    const spellSaveDcs: Partial<Record<number, number>> = {};
    for (let level = 0; level <= maxSpellLevel; level += 1) {
      if ((entry.spellsPerDay[level] ?? 0) > 0) {
        spellSaveDcs[level] = spellSaveDc(abilityMod, level);
      }
    }
    return {
      className: entry.className,
      castingType: entry.castingType,
      castingAbility: entry.castingAbility,
      casterLevel: entry.casterLevel,
      concentration,
      spellsPerDay: entry.spellsPerDay,
      spellSaveDcs,
      maxSpellLevel,
    };
  });
}
