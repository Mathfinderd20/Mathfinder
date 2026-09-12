import type {
  SpellLibraryState,
  AbilityKey,
  CharacterInput,
  DerivedSpellcasting,
  DerivedStat,
  SpellSelectionByLevel,
  SpellSelectionDiagnostic,
  SpellcastingEntry,
  SpellAccess,
} from "./types";
import type { DerivedAbility } from "./types";
import { modifiersFor, resolveModifiers } from "./modifiers";
import {
  SPELLS,
  classSpellLevel,
  getSpell,
  type SpellRegistry,
} from "./content/spells";

/** Legacy catalogs predate spellAccess. Never infer full-list access merely
 * from prepared casting: wizards, witches, and magi acquire spells individually.
 * Explicit content metadata also supports archetypes and custom classes.
 */
export function spellAccessForEntry(
  entry: Pick<SpellcastingEntry, "className" | "castingType" | "spellAccess">,
): SpellAccess {
  if (entry.spellAccess) return entry.spellAccess;
  if (entry.castingType === "spontaneous") return "limited-known";
  return [
    "cleric",
    "druid",
    "paladin",
    "ranger",
    "antipaladin",
    "shaman",
    "warpriest",
  ].includes(entry.className.trim().toLowerCase())
    ? "full-list"
    : "spellbook";
}

export function spellLevelLabel(
  casting: Pick<SpellcastingEntry, "zeroLevelLabel">,
  level: number,
): string {
  return level === 0
    ? casting.zeroLevelLabel?.trim() || "Level 0"
    : `Level ${level}`;
}

function uniqueSpellNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Zero base slots means unlocked, with only ability bonus slots available. */
function unlockedSpellLevels(entry: SpellcastingEntry): number[] {
  return Object.entries(entry.spellsPerDay)
    .filter(([, count]) => count !== undefined && count >= 0)
    .map(([level]) => Number(level));
}

function stat(total: number): DerivedStat {
  return {
    total,
    breakdown: [{ source: "spellcasting", type: "untyped", value: total }],
  };
}

function cloneSelections(
  byLevel: SpellSelectionByLevel | undefined,
): SpellSelectionByLevel {
  const out: SpellSelectionByLevel = {};
  for (const [level, names] of Object.entries(byLevel ?? {})) {
    out[Number(level)] = [...(names ?? [])];
  }
  return out;
}

function positiveLevels(
  byLevel: Partial<Record<number, number>> | undefined,
): number[] {
  return Object.entries(byLevel ?? {})
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([level]) => Number(level));
}

function selectedLevels(byLevel: SpellSelectionByLevel | undefined): number[] {
  return Object.entries(byLevel ?? {})
    .filter(([, names]) => (names?.length ?? 0) > 0)
    .map(([level]) => Number(level));
}

function maxSpellLevel(entry: SpellcastingEntry): number {
  const levels = [
    ...unlockedSpellLevels(entry),
    ...positiveLevels(entry.spellsKnown),
    ...positiveLevels(entry.extraSlots),
    ...selectedLevels(entry.grantedSpells),
    ...selectedLevels(entry.library),
    ...selectedLevels(entry.selections?.prepared),
    ...selectedLevels(entry.selections?.known),
  ];
  return levels.length > 0 ? Math.max(...levels) : 0;
}

function canCastSpellLevel(
  castingAbilityScore: number,
  spellLevel: number,
): boolean {
  return spellLevel === 0 || castingAbilityScore >= 10 + spellLevel;
}

function maxCastableSpellLevel(castingAbilityScore: number): number {
  return Math.max(0, castingAbilityScore - 10);
}

export function bonusSpellSlots(
  castingAbilityMod: number,
  spellLevel: number,
): number {
  if (spellLevel <= 0) return 0;
  return Math.max(0, Math.floor((castingAbilityMod - spellLevel) / 4) + 1);
}

export function spellSaveDc(
  castingAbilityMod: number,
  spellLevel: number,
): number {
  return 10 + spellLevel + castingAbilityMod;
}

function deriveSchoolSaveDcBonuses(input: CharacterInput) {
  const prefix = "spell.dc.school.";
  const schools = [
    ...new Set(
      input.modifiers
        .map((modifier) => modifier.target.toString().toLowerCase())
        .filter((target) => target.startsWith(prefix))
        .map((target) => target.slice(prefix.length))
        .filter(Boolean),
    ),
  ];
  return Object.fromEntries(
    schools.map((school) => {
      const resolved = resolveModifiers(
        modifiersFor(input.modifiers, `${prefix}${school}`),
      );
      return [
        school,
        {
          total: resolved.total,
          breakdown: resolved.contributing.map((modifier) => ({
            source: modifier.source,
            type: modifier.type,
            value: modifier.value,
          })),
        },
      ];
    }),
  );
}

export function spellSaveDcForSchool(
  spellcasting: DerivedSpellcasting,
  spellLevel: number,
  school: string | undefined,
): number | undefined {
  const baseDc = spellcasting.spellSaveDcs[spellLevel];
  if (baseDc === undefined) return undefined;
  const schoolBonus = school
    ? (spellcasting.spellSaveDcBonusesBySchool[school.trim().toLowerCase()]
        ?.total ?? 0)
    : 0;
  return baseDc + schoolBonus;
}

export function deriveSpellcasting(
  input: CharacterInput,
  abilities: Record<AbilityKey, DerivedAbility>,
  spellRegistry: SpellRegistry = SPELLS,
): DerivedSpellcasting[] {
  const entries = input.spellcasting ?? [];
  const spellSaveDcBonusesBySchool = deriveSchoolSaveDcBonuses(input);
  return entries.map((entry: SpellcastingEntry) => {
    const spellAccess = spellAccessForEntry(entry);
    const unlockedLevels = new Set(unlockedSpellLevels(entry));
    const ability = abilities[entry.castingAbility];
    const abilityScore = ability.score;
    const abilityMod = ability.mod;
    const concentration = stat(entry.casterLevel + abilityMod);
    const highestTrackedLevel = maxSpellLevel(entry);
    let highestCastableLevel = maxCastableSpellLevel(abilityScore);
    const bonusSpellsPerDay: Partial<Record<number, number>> = {};
    const extraSlotsPerDay: Partial<Record<number, number>> = {};
    const restrictedExtraSlotsPerDay: Partial<Record<number, number>> = {};
    const totalSpellsPerDay: Partial<Record<number, number>> = {};
    const spellSaveDcs: Partial<Record<number, number>> = {};
    const slotsUsed: Partial<Record<number, number>> = {};
    const slotsRemaining: Partial<Record<number, number>> = {};
    const selectionDiagnostics: Partial<
      Record<number, SpellSelectionDiagnostic>
    > = {};

    for (let level = 0; level <= highestTrackedLevel; level += 1) {
      const baseSlots = entry.spellsPerDay[level] ?? 0;
      const extraSlots = Math.max(0, entry.extraSlots?.[level] ?? 0);
      const restrictedExtraSlots = Math.max(
        0,
        entry.restrictedExtraSlots?.[level] ?? 0,
      );
      const meetsCastingAbility = canCastSpellLevel(abilityScore, level);
      const isAtWill = level === 0;
      const bonusSlots =
        unlockedLevels.has(level) && meetsCastingAbility
          ? bonusSpellSlots(abilityMod, level)
          : 0;
      const abilityIndependentDomainSlots = entry.domains?.length
        ? restrictedExtraSlots
        : 0;
      const abilityGatedRestrictedSlots = Math.max(
        0,
        restrictedExtraSlots - abilityIndependentDomainSlots,
      );
      const unrestrictedExtraSlots = Math.max(
        0,
        extraSlots - restrictedExtraSlots,
      );
      const totalSlots =
        (meetsCastingAbility
          ? baseSlots +
            bonusSlots +
            unrestrictedExtraSlots +
            abilityGatedRestrictedSlots
          : 0) + abilityIndependentDomainSlots;
      if (totalSlots > 0)
        highestCastableLevel = Math.max(highestCastableLevel, level);
      if (unlockedLevels.has(level) || extraSlots > 0 || totalSlots > 0) {
        bonusSpellsPerDay[level] = bonusSlots;
        extraSlotsPerDay[level] = extraSlots;
        restrictedExtraSlotsPerDay[level] = restrictedExtraSlots;
        totalSpellsPerDay[level] = totalSlots;
        spellSaveDcs[level] = spellSaveDc(abilityMod, level);
        const used = isAtWill
          ? 0
          : Math.min(entry.slotsUsed?.[level] ?? 0, totalSlots);
        slotsUsed[level] = used;
        slotsRemaining[level] = isAtWill
          ? totalSlots
          : Math.max(0, totalSlots - used);
      }
    }

    const grantedSpells = cloneSelections(entry.grantedSpells);
    for (const level of Object.keys(grantedSpells).map(Number)) {
      if (!unlockedLevels.has(level)) delete grantedSpells[level];
      else
        grantedSpells[level] = uniqueSpellNames(
          (grantedSpells[level] ?? []).map(
            (name) => getSpell(spellRegistry, name)?.name ?? name,
          ),
        );
    }
    const restrictedOnlySpells: SpellLibraryState = {};
    const manualLibrarySpells = cloneSelections(entry.library);
    const librarySpells = cloneSelections(entry.library);
    const selectedPreparedSpells = cloneSelections(entry.selections?.prepared);
    const selectedKnownSpells = cloneSelections(entry.selections?.known);
    const selectionSource =
      entry.castingType === "prepared"
        ? selectedPreparedSpells
        : selectedKnownSpells;
    const capacitySource =
      entry.castingType === "prepared"
        ? totalSpellsPerDay
        : (entry.spellsKnown ?? {});

    for (let level = 0; level <= highestTrackedLevel; level += 1) {
      const selected = selectionSource[level] ?? [];
      const availableSpellNames = Object.values(spellRegistry)
        .filter((spell) => classSpellLevel(spell, entry.className) === level)
        .map((spell) => spell.name)
        .sort((a, b) => a.localeCompare(b));
      const manualLibrarySpellNames = manualLibrarySpells[level] ?? [];
      if (spellAccess === "full-list" && unlockedLevels.has(level)) {
        librarySpells[level] = uniqueSpellNames([
          ...availableSpellNames,
          ...manualLibrarySpellNames,
        ]);
      }
      const librarySpellNames = uniqueSpellNames([
        ...(grantedSpells[level] ?? []),
        ...(librarySpells[level] ?? []),
      ]);
      if (librarySpellNames.length || librarySpells[level])
        librarySpells[level] = librarySpellNames;
      const levelGrants = grantedSpells[level] ?? [];
      if (entry.domains?.length)
        restrictedOnlySpells[level] = levelGrants.filter((name) => {
          const spell = getSpell(spellRegistry, name);
          return !spell || classSpellLevel(spell, entry.className) !== level;
        });
      const unknownSpells: string[] = [];
      const offListSpells: string[] = [];
      const wrongLevelSpells: { name: string; actualLevel: number }[] = [];
      const missingFromLibrary: string[] = [];
      for (const name of selected) {
        const spell = getSpell(spellRegistry, name);
        if (!spell) {
          unknownSpells.push(name);
          continue;
        }
        const actualLevel = classSpellLevel(spell, entry.className);
        const isGranted = levelGrants.some(
          (grant) => grant.toLowerCase() === name.toLowerCase(),
        );
        if (actualLevel === undefined && !isGranted) offListSpells.push(name);
        else if (
          actualLevel !== undefined &&
          actualLevel !== level &&
          !isGranted
        )
          wrongLevelSpells.push({ name, actualLevel });
        if (
          (spellAccess === "full-list" || manualLibrarySpellNames.length > 0) &&
          !librarySpellNames.some((n) => n.toLowerCase() === name.toLowerCase())
        ) {
          missingFromLibrary.push(name);
        }
      }
      const capacity = capacitySource[level] ?? 0;
      const selectedCount =
        entry.castingType === "spontaneous"
          ? selected.filter(
              (name) =>
                !levelGrants.some(
                  (grant) => grant.toLowerCase() === name.toLowerCase(),
                ),
            ).length
          : selected.length;
      const requiredAbilityScore = level === 0 ? 0 : 10 + level;
      const meetsCastingAbility = canCastSpellLevel(abilityScore, level);
      const isAtWill = level === 0;
      const restrictedSlotCapacity = Math.max(
        0,
        entry.restrictedExtraSlots?.[level] ?? 0,
      );
      const canCastLevel =
        meetsCastingAbility ||
        ((entry.domains?.length ?? 0) > 0 && restrictedSlotCapacity > 0);
      const restrictedSlotEligibleSpellNames = grantedSpells[level] ?? [];
      const restrictedSlotEligibleSelectedCount = selected.filter((name) =>
        restrictedSlotEligibleSpellNames.some(
          (n) => n.toLowerCase() === name.toLowerCase(),
        ),
      ).length;
      const unrestrictedCapacity = Math.max(
        0,
        capacity - restrictedSlotCapacity,
      );
      const unrestrictedSelectedCount =
        selected.length - restrictedSlotEligibleSelectedCount;
      const usesDedicatedDomainSlot =
        entry.castingType === "prepared" && (entry.domains?.length ?? 0) > 0;
      const restrictedSlotShortfall = Math.max(
        0,
        usesDedicatedDomainSlot
          ? restrictedSlotEligibleSelectedCount - restrictedSlotCapacity
          : entry.castingType === "prepared"
            ? selected.filter((name) =>
                (restrictedOnlySpells[level] ?? []).some(
                  (grant) => grant.toLowerCase() === name.toLowerCase(),
                ),
              ).length - restrictedSlotCapacity
            : 0,
        usesDedicatedDomainSlot
          ? unrestrictedSelectedCount - unrestrictedCapacity
          : entry.castingType === "prepared"
            ? selected.length -
              unrestrictedCapacity -
              restrictedSlotEligibleSelectedCount
            : 0,
      );
      if (
        selected.length > 0 ||
        capacity > 0 ||
        availableSpellNames.length > 0 ||
        librarySpellNames.length > 0
      ) {
        selectionDiagnostics[level] = {
          mode: entry.castingType,
          level,
          capacity,
          selectedCount,
          availableSpellNames,
          librarySpellNames,
          unknownSpells,
          offListSpells,
          wrongLevelSpells,
          missingFromLibrary,
          requiredAbilityScore,
          meetsCastingAbility,
          canCastLevel,
          isAtWill,
          overCapacity: selectedCount > capacity,
          restrictedSlotCapacity,
          restrictedSlotEligibleSpellNames,
          restrictedSlotEligibleSelectedCount,
          restrictedSlotShortfall,
        };
      }
    }

    return {
      className: entry.className,
      castingType: entry.castingType,
      spellAccess,
      castingAbility: entry.castingAbility,
      zeroLevelLabel: entry.zeroLevelLabel?.trim() || "Level 0",
      castingAbilityScore: abilityScore,
      maxCastableSpellLevel: highestCastableLevel,
      casterLevel: entry.casterLevel,
      domains: [...(entry.domains ?? [])],
      bloodline: entry.bloodline,
      specialistSchool: entry.specialistSchool,
      concentration,
      baseSpellsPerDay: entry.spellsPerDay,
      bonusSpellsPerDay,
      extraSlotsPerDay,
      restrictedExtraSlotsPerDay,
      spellsPerDay: totalSpellsPerDay,
      spellsKnown: entry.spellsKnown ?? {},
      preparedCapacity:
        entry.castingType === "prepared" ? totalSpellsPerDay : {},
      grantedSpells,
      restrictedOnlySpells,
      manualLibrarySpells,
      librarySpells,
      selectedPreparedSpells,
      selectedKnownSpells,
      selectionDiagnostics,
      slotsUsed,
      slotsRemaining,
      spellSaveDcs,
      spellSaveDcBonusesBySchool,
      maxSpellLevel: highestTrackedLevel,
    };
  });
}
