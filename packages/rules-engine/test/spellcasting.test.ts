import { describe, expect, it } from "vitest";
import { computeSheet } from "../src/compute";
import {
  buildCharacter,
  type CharacterBuild,
  validateBuild,
} from "../src/build/character";
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

describe("runtime spell registries", () => {
  it("validates selected spells against the supplied runtime catalog", () => {
    const build: CharacterBuild = {
      name: "Catalog Caster",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 12,
        con: 12,
        int: 10,
        wis: 10,
        cha: 18,
      },
      levels: [{ className: "Sorcerer", hitPointRoll: 6, feats: [] }],
      spellSelections: {
        sorcerer: { known: { 1: ["Runtime-Only Spell"] } },
      },
    };
    const sheet = computeSheet(buildCharacter(build), {
      spellRegistry: {
        "runtime-only spell": {
          id: "runtime-only-spell",
          name: "Runtime-Only Spell",
          pack: "test",
          classes: [{ className: "sorcerer", level: 1 }],
        },
      },
    });
    expect(
      sheet.spellcasting[0]?.selectionDiagnostics[1]?.unknownSpells,
    ).toEqual([]);
  });
});

describe("wizard spellcasting", () => {
  it("derives prepared casting with prep capacity", () => {
    const build: CharacterBuild = {
      name: "Merisiel But Nerdier",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
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
    expect(sheet.spellcasting[0]!.selectionDiagnostics[0]).toMatchObject({
      level: 0,
      isAtWill: true,
      canCastLevel: true,
      capacity: 3,
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      mode: "prepared",
      level: 1,
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: [
        "Burning Hands",
        "Color Spray",
        "Grease",
        "Longstrider",
        "Mage Armor",
        "Magic Missile",
        "Protection from Evil",
        "Shield",
        "Silent Image",
      ],
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });

  it("applies specialist school bonus slots and granted school spells", () => {
    const build: CharacterBuild = {
      name: "Pointy Hat Tryhard",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSpecializations: {
        wizard: "conjuration",
      },
      spellSelections: {
        wizard: {
          prepared: {
            1: ["Mage Armor", "Grease", "Mage Armor"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      specialistSchool: "conjuration",
      baseSpellsPerDay: { 0: 3, 1: 1 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      extraSlotsPerDay: { 0: 0, 1: 1 },
      spellsPerDay: { 0: 3, 1: 3 },
      preparedCapacity: { 0: 3, 1: 3 },
    });
    expect(sheet.spellcasting[0]!.grantedSpells[1]).toEqual([
      "Grease",
      "Mage Armor",
    ]);
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 3,
      selectedCount: 3,
      overCapacity: false,
      restrictedSlotCapacity: 1,
      restrictedSlotEligibleSelectedCount: 3,
      restrictedSlotShortfall: 0,
      librarySpellNames: ["Grease", "Mage Armor"],
    });
    expect(validateBuild(build)).toEqual([]);
  });

  it("flags specialist preparations that do not satisfy restricted slots", () => {
    const build: CharacterBuild = {
      name: "Fake Specialist",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSpecializations: {
        wizard: "conjuration",
      },
      spellSelections: {
        wizard: {
          prepared: {
            1: ["Magic Missile", "Shield", "Color Spray"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 3,
      restrictedSlotCapacity: 1,
      restrictedSlotEligibleSelectedCount: 0,
      restrictedSlotShortfall: 1,
    });
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "prepared-spells-miss-restricted-slots",
    );
  });

  it("flags unknown specialist schools", () => {
    const build: CharacterBuild = {
      name: "Fake School Guy",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSpecializations: {
        wizard: "chronomancy",
      },
    };
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "unknown-specialist-school",
    );
  });
});

describe("cleric, druid, bard, ranger, paladin, inquisitor, and sorcerer spellcasting", () => {
  it("derives cleric prepared casting with Wisdom bonus slots", () => {
    const build: CharacterBuild = {
      name: "Hammerbro Priest",
      race: { name: "Dwarf", size: "medium", speed: 20 },
      baseAbilityScores: {
        str: 12,
        dex: 10,
        con: 14,
        int: 10,
        wis: 16,
        cha: 8,
      },
      levels: [{ className: "Cleric", hitPointRoll: 8, feats: [] }],
      spellDomains: {
        cleric: ["good", "healing"],
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Cleric",
      castingType: "prepared",
      castingAbility: "wis",
      domains: ["good", "healing"],
      spellsPerDay: { 0: 3, 1: 3 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      extraSlotsPerDay: { 0: 0, 1: 1 },
      preparedCapacity: { 0: 3, 1: 3 },
      spellsKnown: {},
    });
    expect(sheet.spellcasting[0]!.grantedSpells[1]).toEqual([
      "Bless",
      "Cure Light Wounds",
    ]);
  });

  it("flags cleric preparations that do not satisfy domain slot restrictions", () => {
    const build: CharacterBuild = {
      name: "Cheaty Priest",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 12,
        int: 10,
        wis: 16,
        cha: 10,
      },
      levels: [{ className: "Cleric", hitPointRoll: 8, feats: [] }],
      spellDomains: {
        cleric: ["good", "healing"],
      },
      spellSelections: {
        cleric: {
          prepared: {
            1: ["Shield of Faith", "Shield of Faith", "Shield of Faith"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 3,
      restrictedSlotCapacity: 1,
      restrictedSlotEligibleSelectedCount: 0,
      restrictedSlotShortfall: 1,
      restrictedSlotEligibleSpellNames: ["Bless", "Cure Light Wounds"],
    });
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "prepared-spells-miss-restricted-slots",
    );
  });

  it("warns on incomplete or duplicate cleric domains", () => {
    const duplicateBuild: CharacterBuild = {
      name: "Bad Priest",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 12,
        int: 10,
        wis: 16,
        cha: 10,
      },
      levels: [{ className: "Cleric", hitPointRoll: 8, feats: [] }],
      spellDomains: {
        cleric: ["good", "good"],
      },
    };
    expect(validateBuild(duplicateBuild).map((issue) => issue.code)).toContain(
      "duplicate-domain",
    );

    const incompleteBuild: CharacterBuild = {
      ...duplicateBuild,
      spellDomains: {
        cleric: ["good"],
      },
    };
    const incompleteCodes = validateBuild(incompleteBuild).map(
      (issue) => issue.code,
    );
    expect(incompleteCodes).toContain("cleric-domains-incomplete");
  });

  it("applies manual extra spell slots on top of base and bonus slots", () => {
    const build: CharacterBuild = {
      name: "Domain-ish Cleric",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 12,
        int: 10,
        wis: 16,
        cha: 10,
      },
      levels: [{ className: "Cleric", hitPointRoll: 8, feats: [] }],
      spellExtraSlots: {
        cleric: { 1: 1 },
      },
      spellSelections: {
        cleric: {
          prepared: {
            1: ["Bless", "Cure Light Wounds", "Bless"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      baseSpellsPerDay: { 0: 3, 1: 1 },
      bonusSpellsPerDay: { 0: 0, 1: 1 },
      extraSlotsPerDay: { 0: 0, 1: 1 },
      spellsPerDay: { 0: 3, 1: 3 },
      preparedCapacity: { 0: 3, 1: 3 },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 3,
      selectedCount: 3,
      overCapacity: false,
    });
    expect(validateBuild(build)).toEqual([]);
  });

  it("derives druid prepared casting with nature-flavored spell access", () => {
    const build: CharacterBuild = {
      name: "Moss Goblin",
      race: { name: "Elf", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 12,
        con: 12,
        int: 10,
        wis: 18,
        cha: 8,
      },
      levels: [
        { className: "Druid", hitPointRoll: 8, feats: [] },
        { className: "Druid", hitPointRoll: 5, feats: [] },
        { className: "Druid", hitPointRoll: 5, feats: [] },
      ],
      spellSelections: {
        druid: {
          prepared: {
            0: ["Guidance", "Light", "Resistance", "Detect Magic"],
            1: ["Entangle", "Cure Light Wounds", "Longstrider"],
            2: ["Barkskin", "Resist Energy"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Druid",
      castingType: "prepared",
      castingAbility: "wis",
      baseSpellsPerDay: { 0: 4, 1: 2, 2: 1 },
      bonusSpellsPerDay: { 0: 0, 1: 1, 2: 1 },
      spellsPerDay: { 0: 4, 1: 3, 2: 2 },
      preparedCapacity: { 0: 4, 1: 3, 2: 2 },
      selectedPreparedSpells: {
        0: ["Guidance", "Light", "Resistance", "Detect Magic"],
        1: ["Entangle", "Cure Light Wounds", "Longstrider"],
        2: ["Barkskin", "Resist Energy"],
      },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 3,
      selectedCount: 3,
      overCapacity: false,
      availableSpellNames: [
        "Cure Light Wounds",
        "Entangle",
        "Longstrider",
        "Magic Fang",
      ],
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[2]).toMatchObject({
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: [
        "Barkskin",
        "Bull's Strength",
        "Cure Moderate Wounds",
        "Delay Poison",
        "Flaming Sphere",
        "Resist Energy",
      ],
    });
  });

  it("derives bard spontaneous casting with broader support spells known", () => {
    const build: CharacterBuild = {
      name: "Lute Menace",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 10,
        wis: 10,
        cha: 18,
      },
      levels: [
        { className: "Bard", hitPointRoll: 8, feats: [] },
        { className: "Bard", hitPointRoll: 5, feats: [] },
        { className: "Bard", hitPointRoll: 5, feats: [] },
        { className: "Bard", hitPointRoll: 5, feats: [] },
      ],
      spellSelections: {
        bard: {
          known: {
            0: [
              "Daze",
              "Detect Magic",
              "Light",
              "Resistance",
              "Mage Hand",
              "Read Magic",
            ],
            1: ["Charm Person", "Cure Light Wounds", "Grease", "Silent Image"],
            2: ["Hideous Laughter", "Resist Energy"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Bard",
      castingType: "spontaneous",
      castingAbility: "cha",
      baseSpellsPerDay: { 0: 6, 1: 4, 2: 2 },
      bonusSpellsPerDay: { 0: 0, 1: 1, 2: 1 },
      spellsPerDay: { 0: 6, 1: 5, 2: 3 },
      spellsKnown: { 0: 6, 1: 4, 2: 2 },
      selectedKnownSpells: {
        0: [
          "Daze",
          "Detect Magic",
          "Light",
          "Resistance",
          "Mage Hand",
          "Read Magic",
        ],
        1: ["Charm Person", "Cure Light Wounds", "Grease", "Silent Image"],
        2: ["Hideous Laughter", "Resist Energy"],
      },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      mode: "spontaneous",
      capacity: 4,
      selectedCount: 4,
      overCapacity: false,
      availableSpellNames: [
        "Charm Person",
        "Cure Light Wounds",
        "Grease",
        "Longstrider",
        "Silent Image",
      ],
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[2]).toMatchObject({
      mode: "spontaneous",
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: [
        "Bull's Strength",
        "Cure Moderate Wounds",
        "Hideous Laughter",
        "Hold Person",
        "Resist Energy",
      ],
    });
  });

  it("derives ranger prepared casting once delayed spellcasting kicks in", () => {
    const build: CharacterBuild = {
      name: "Arrow Dork",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 12,
        dex: 16,
        con: 12,
        int: 10,
        wis: 14,
        cha: 8,
      },
      levels: [
        { className: "Ranger", hitPointRoll: 10, feats: [] },
        { className: "Ranger", hitPointRoll: 6, feats: [] },
        { className: "Ranger", hitPointRoll: 6, feats: [] },
        { className: "Ranger", hitPointRoll: 6, feats: [] },
      ],
      spellSelections: {
        ranger: {
          prepared: {
            1: ["Gravity Bow", "Lead Blades"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Ranger",
      castingType: "prepared",
      castingAbility: "wis",
      baseSpellsPerDay: { 1: 1 },
      bonusSpellsPerDay: { 1: 1 },
      spellsPerDay: { 1: 2 },
      preparedCapacity: { 1: 2 },
      selectedPreparedSpells: { 1: ["Gravity Bow", "Lead Blades"] },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: [
        "Aspect of the Falcon",
        "Entangle",
        "Gravity Bow",
        "Lead Blades",
      ],
    });
  });

  it("derives paladin prepared casting with holy support picks", () => {
    const build: CharacterBuild = {
      name: "Lawful Smiter",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 16,
        dex: 10,
        con: 14,
        int: 10,
        wis: 14,
        cha: 14,
      },
      levels: [
        { className: "Paladin", hitPointRoll: 10, feats: [] },
        { className: "Paladin", hitPointRoll: 6, feats: [] },
        { className: "Paladin", hitPointRoll: 6, feats: [] },
        { className: "Paladin", hitPointRoll: 6, feats: [] },
      ],
      spellSelections: {
        paladin: {
          prepared: {
            1: ["Bless Weapon", "Divine Favor"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Paladin",
      castingType: "prepared",
      castingAbility: "wis",
      baseSpellsPerDay: { 1: 1 },
      bonusSpellsPerDay: { 1: 1 },
      spellsPerDay: { 1: 2 },
      preparedCapacity: { 1: 2 },
      selectedPreparedSpells: { 1: ["Bless Weapon", "Divine Favor"] },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: [
        "Bless Weapon",
        "Detect Evil",
        "Divine Favor",
        "Magic Weapon",
        "Protection from Evil",
        "Shield of Faith",
      ],
    });
  });

  it("derives inquisitor spontaneous casting with judgment-flavored spells known", () => {
    const build: CharacterBuild = {
      name: "Church Cop",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 12,
        dex: 12,
        con: 12,
        int: 10,
        wis: 16,
        cha: 8,
      },
      levels: [
        { className: "Inquisitor", hitPointRoll: 8, feats: [] },
        { className: "Inquisitor", hitPointRoll: 5, feats: [] },
        { className: "Inquisitor", hitPointRoll: 5, feats: [] },
        { className: "Inquisitor", hitPointRoll: 5, feats: [] },
      ],
      spellSelections: {
        inquisitor: {
          known: {
            1: ["Detect Evil", "Divine Favor", "Doom", "Protection from Evil"],
            2: ["Aid", "Hold Person"],
          },
        },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Inquisitor",
      castingType: "spontaneous",
      castingAbility: "wis",
      baseSpellsPerDay: { 1: 3, 2: 1 },
      bonusSpellsPerDay: { 1: 1, 2: 1 },
      spellsPerDay: { 1: 4, 2: 2 },
      spellsKnown: { 1: 4, 2: 2 },
      selectedKnownSpells: {
        1: ["Detect Evil", "Divine Favor", "Doom", "Protection from Evil"],
        2: ["Aid", "Hold Person"],
      },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      mode: "spontaneous",
      capacity: 4,
      selectedCount: 4,
      overCapacity: false,
      availableSpellNames: [
        "Detect Evil",
        "Divine Favor",
        "Doom",
        "Magic Weapon",
        "Protection from Evil",
        "Shield of Faith",
      ],
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[2]).toMatchObject({
      mode: "spontaneous",
      capacity: 2,
      selectedCount: 2,
      overCapacity: false,
      availableSpellNames: [
        "Aid",
        "Bull's Strength",
        "Cure Moderate Wounds",
        "Delay Poison",
        "Hold Person",
        "Resist Energy",
      ],
    });
  });

  it("derives sorcerer spontaneous casting with spells known", () => {
    const build: CharacterBuild = {
      name: "Hot Topic Dragonkid",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 10,
        wis: 10,
        cha: 18,
      },
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
      availableSpellNames: [
        "Burning Hands",
        "Color Spray",
        "Grease",
        "Longstrider",
        "Mage Armor",
        "Magic Missile",
        "Protection from Evil",
        "Shield",
        "Silent Image",
      ],
    });
    expect(sheet.spellcasting[0]!.concentration.total).toBe(5);
  });

  it("treats 0-level spells as at-will runtime while still tracking prep capacity", () => {
    const build: CharacterBuild = {
      name: "Cantrip Goblin",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6, feats: [] }],
      spellSlotUsage: {
        wizard: { 0: 99 },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      slotsUsed: { 0: 0, 1: 0 },
      slotsRemaining: { 0: 3, 1: 2 },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[0]).toMatchObject({
      isAtWill: true,
      capacity: 3,
    });
  });

  it("blocks spell levels the caster ability score cannot support", () => {
    const build: CharacterBuild = {
      name: "Book Dumb But Hopeful",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [
        { className: "Wizard", hitPointRoll: 6, feats: [] },
        { className: "Wizard", hitPointRoll: 4, feats: [] },
        { className: "Wizard", hitPointRoll: 3, feats: [] },
      ],
      spellSelections: {
        wizard: {
          prepared: {
            1: ["Mage Armor"],
            2: ["Invisibility"],
          },
        },
      },
      spellLibrary: {
        wizard: {
          1: ["Mage Armor"],
          2: ["Invisibility"],
        },
      },
      spellSlotUsage: {
        wizard: { 1: 1, 2: 1 },
      },
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.spellcasting[0]).toMatchObject({
      className: "Wizard",
      castingAbility: "int",
      castingAbilityScore: 10,
      maxCastableSpellLevel: 0,
      baseSpellsPerDay: { 0: 4, 1: 2, 2: 1 },
      bonusSpellsPerDay: { 0: 0, 1: 0, 2: 0 },
      spellsPerDay: { 0: 4, 1: 0, 2: 0 },
      preparedCapacity: { 0: 4, 1: 0, 2: 0 },
      slotsUsed: { 0: 0, 1: 0, 2: 0 },
      slotsRemaining: { 0: 4, 1: 0, 2: 0 },
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[1]).toMatchObject({
      capacity: 0,
      canCastLevel: false,
      requiredAbilityScore: 11,
      overCapacity: true,
      missingFromLibrary: [],
    });
    expect(sheet.spellcasting[0]!.selectionDiagnostics[2]).toMatchObject({
      capacity: 0,
      canCastLevel: false,
      requiredAbilityScore: 12,
      overCapacity: true,
    });
    expect(validateBuild(build).map((issue) => issue.code)).toContain(
      "spell-level-ability-gated",
    );
  });

  it("flags unknown off-list and wrong-level spell selections in diagnostics", () => {
    const build: CharacterBuild = {
      name: "Bad Wizard Choices",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 12,
        int: 18,
        wis: 10,
        cha: 10,
      },
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
    expect(
      sheet.spellcasting[0]!.selectionDiagnostics[1]?.wrongLevelSpells,
    ).toEqual([{ name: "Detect Magic", actualLevel: 0 }]);
  });
});
