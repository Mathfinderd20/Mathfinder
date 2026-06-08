import type {
  AbilityKey,
  CharacterInput,
  DerivedSpellcasting,
  DerivedStat,
  SpellcastingEntry,
  SpellSelectionDiagnostic,
} from "./types";
import type { DerivedAbility } from "./types";
import { SPELLS, classSpellLevel, getSpell } from "./content/spells";

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
    const slotsUsed: Partial<Record<number, number>> = {};
    const slotsRemaining: Partial<Record<number, number>> = {};
    const selectionDiagnostics: Partial<Record<number, SpellSelectionDiagnostic>> = {};
    for (let level = 0; level <= maxSpellLevel; level += 1) {
      const baseSlots = entry.spellsPerDay[level] ?? 0;
      if (baseSlots <= 0) continue;
      const bonusSlots = bonusSpellSlots(abilityMod, level);
      bonusSpellsPerDay[level] = bonusSlots;
      totalSpellsPerDay[level] = baseSlots + bonusSlots;
      spellSaveDcs[level] = spellSaveDc(abilityMod, level);
      const used = Math.min(entry.slotsUsed?.[level] ?? 0, totalSpellsPerDay[level]!);
      slotsUsed[level] = used;
      slotsRemaining[level] = Math.max(0, totalSpellsPerDay[level]! - used);
    }
    const selectedPreparedSpells = cloneSelections(entry.selections?.prepared);
    const selectedKnownSpells = cloneSelections(entry.selections?.known);
    const selectionSource = entry.castingType === "prepared" ? selectedPreparedSpells : selectedKnownSpells;
    const capacitySource = entry.castingType === "prepared" ? totalSpellsPerDay : (entry.spellsKnown ?? {});
    for (let level = 0; level <= maxSpellLevel; level += 1) {
      const selected = selectionSource[level] ?? [];
      const availableSpellNames = Object.values(SPELLS)
        .filter((spell) => classSpellLevel(spell, entry.className) === level)
        .map((spell) => spell.name)
        .sort((a, b) => a.localeCompare(b));
      const unknownSpells: string[] = [];
      const offListSpells: string[] = [];
      const wrongLevelSpells: { name: string; actualLevel: number }[] = [];
      for (const name of selected) {
        const spell = getSpell(SPELLS, name);
        if (!spell) {
          unknownSpells.push(name);
          continue;
        }
        const actualLevel = classSpellLevel(spell, entry.className);
        if (actualLevel === undefined) offListSpells.push(name);
        else if (actualLevel !== level) wrongLevelSpells.push({ name, actualLevel });
      }
      const capacity = capacitySource[level] ?? 0;
      if (selected.length > 0 || capacity > 0 || availableSpellNames.length > 0) {
        selectionDiagnostics[level] = {
          mode: entry.castingType,
          level,
          capacity,
          selectedCount: selected.length,
          availableSpellNames,
          unknownSpells,
          offListSpells,
          wrongLevelSpells,
          overCapacity: selected.length > capacity,
        };
      }
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
      selectedPreparedSpells,
      selectedKnownSpells,
      selectionDiagnostics,
      slotsUsed,
      slotsRemaining,
      spellSaveDcs,
      maxSpellLevel,
    };
  });
}
