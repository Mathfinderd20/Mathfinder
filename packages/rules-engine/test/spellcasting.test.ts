import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import { buildCharacter, type CharacterBuild } from "../src/build/character";
import { bonusSpellSlots, spellSaveDc, spellsByLevel } from "../src";

describe("spellcasting helpers", () => {
  it("computes spell save DCs from spell level and casting modifier", () => {
    expect(spellSaveDc(4, 0)).toBe(14);
    expect(spellSaveDc(4, 3)).toBe(17);
  });

  it("computes bonus spell slots from casting modifier", () => {
    expect(bonusSpellSlots(4, 0)).toBe(0);
    expect(bonusSpellSlots(4, 1)).toBe(1);
    expect(bonusSpellSlots(4, 4)).toBe(1);
    expect(bonusSpellSlots(4, 5)).toBe(0);
    expect(bonusSpellSlots(5, 1)).toBe(2);
  });

  it("builds compact spells/day maps", () => {
    expect(spellsByLevel(3, 1)).toEqual({ 0: 3, 1: 1 });
  });
});

describe("wizard spellcasting", () => {
  it("derives prepared casting with prep capacity", () => {
    const build: CharacterBuild = {
      name: "Merisiel But Nerdier",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: {
          prepared: {
            0: ["detect magic", "read magic", "acid splash"],
            1: ["mage armor", "magic missile"],
          },
        },
      },
      spellSlotUsage: {
        wizard: { 1: 1 },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Wizard",
      castingType: "prepared",
      castingAbility: "int",
      casterLevel: 1,
      maxSpellLevel: 1,
      baseSpellsPerDay: { 0: 3, 1: 1 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      spellsPerDay: { 0: 3, 1: 2 },
      preparedCapacity: { 0: 3, 1: 2 },
      spellsKnown: {},
      selectedPreparedSpells: {
        0: ["detect magic", "read magic", "acid splash"],
        1: ["mage armor", "magic missile"],
      },
      selectedKnownSpells: {},
      slotsUsed: { 0: 0, 1: 1 },
      slotsRemaining: { 0: 3, 1: 1 },
      spellSaveDcs: { 0: 14, 1: 15 },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      mode: "prepared",
      level: 1,
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: ["Grease", "Mage Armor", "Magic Missile", "Shield"],
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });
});

describe("cleric and sorcerer spellcasting", () => {
  it("derives cleric prepared casting with Wisdom bonus slots", () => {
    const build: CharacterBuild = {
      name: "Hammerbro Priest",
      race: { name: "Dwarf", size: "medium", speed: 20 },
      baseAbilityScores: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 8 },
      levels: [{ className: "Cleric", hitPointRoll: 8, feats: [] }],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Cleric",
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: { 0: 3, 1: 2 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      preparedCapacity: { 0: 3, 1: 2 },
      spellsKnown: {},
    });
  });

  it("derives sorcerer spontaneous casting with spells known", () => {
    const build: CharacterBuild = {
      name: "Hot Topic Dragonkid",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 },
      levels: [{ className: "Sorcerer", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        sorcerer: {
          known: {
            0: ["detect magic", "read magic", "mage hand", "daze"],
            1: ["magic missile", "shield"],
          },
        },
      },
      spellSlotUsage: {
        sorcerer: { 1: 2 },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Sorcerer",
      castingType: "spontaneous",
      castingAbility: "cha",
      baseSpellsPerDay: { 0: 5, 1: 3 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      spellsPerDay: { 0: 5, 1: 4 },
      spellsKnown: { 0: 4, 1: 2 },
      preparedCapacity: {},
      selectedPreparedSpells: {},
      selectedKnownSpells: {
        0: ["detect magic", "read magic", "mage hand", "daze"],
        1: ["magic missile", "shield"],
      },
      slotsUsed: { 0: 0, 1: 2 },
      slotsRemaining: { 0: 5, 1: 2 },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      mode: "spontaneous",
      level: 1,
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: ["Grease", "Mage Armor", "Magic Missile", "Shield"]
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });

  it("flags unknown off-list and wrong-level spell selections in diagnostics", () => {
    const build: CharacterBuild = {
      name: "Bad Wizard Choices",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        wizard: {
          prepared: {
            1: ["Bless", "Detect Magic", "Fake Spell"],
          },
        },
      },
    };
    build.spellLibrary = {
      wizard: {
        1: ["Mage Armor"],
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]!.librarySpells[1]).toEqual(["Mage Armor"]);
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 2,
      selectedCount: 3,
      overCapacity: true,
      offListSpells: ["Bless"],
      unknownSpells: ["Fake Spell"],
      missingFromLibrary: ["Bless", "Detect Magic"],
      librarySpellNames: ["Mage Armor"],
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]?.wrongLevelSpells).toEqual([
      { name: "Detect Magic", actualLevel: 0 },
    ]);
  });
});
