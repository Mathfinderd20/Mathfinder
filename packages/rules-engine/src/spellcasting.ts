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

function cloneSelections(byLevel: Partial<Record<number, string[]>> | undefined): Partial<Record<number, string[]>> {
  const out: Partial<Record<number, string[]>> = {};
  for (const [level, names] of Object.entries(byLevel ?? {})) {
    out[Number(level)] = [...(names ?? [])];
  }
  return out;
}

function maxSpellLevelFromSlots(spellsPerDay: Partial<Record<number, number>>): number {
  const levels = Object.entries(spellsPerDay)
    .filter(([, slots]) => (slots ?? 0) > 0)
    .map(([level]) => Number(level));
  return levels.length > 0 ? Math.max(...levels) : 0;
}

export function bonusSpellSlots(castingAbilityMod: number, spellLevel: number): number {
  if (spellLevel <= 0) return 0;
  return Math.max(0, Math.floor((castingAbilityMod - spellLevel) / 4) + 1);
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
    const bonusSpellsPerDay: Partial<Record<number, number>> = {};
    const totalSpellsPerDay: Partial<Record<number, number>> = {};
    const spellSaveDcs: Partial<Record<number, number>> = {};
    for (let level = 0; level <= maxSpellLevel; level += 1) {
      const baseSlots = entry.spellsPerDay[level] ?? 0;
      if (baseSlots <= 0) continue;
      const bonusSlots = bonusSpellSlots(abilityMod, level);
      bonusSpellsPerDay[level] = bonusSlots;
      totalSpellsPerDay[level] = baseSlots + bonusSlots;
      spellSaveDcs[level] = spellSaveDc(abilityMod, level);
    }
    return {
      className: entry.className,
      castingType: entry.castingType,
      castingAbility: entry.castingAbility,
      casterLevel: entry.casterLevel,
      concentration,
      baseSpellsPerDay: entry.spellsPerDay,
      bonusSpellsPerDay,
      spellsPerDay: totalSpellsPerDay,
      spellsKnown: entry.spellsKnown ?? {},
      preparedCapacity: entry.castingType === "prepared" ? totalSpellsPerDay : {},
      selectedPreparedSpells: cloneSelections(entry.selections?.prepared),
      selectedKnownSpells: cloneSelections(entry.selections?.known),
      spellSaveDcs,
      maxSpellLevel,
    };
  });
}
