import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_RULES,
  buildCharacter,
  planLevelUp,
  validateBuild,
  type ArchetypeRegistry,
  type CharacterBuild,
} from "../src";
import { computeSheet } from "../src/compute";
import type { ClassRegistry } from "../src/build/classes";

const TEST_ARCHETYPES: ArchetypeRegistry = {
  "battle-chaplain": {
    id: "battle-chaplain",
    name: "Battle Chaplain",
    baseClassName: "Cleric",
    description: "Trades domains for martial doctrine.",
    replaces: ["domains"],
    features: [{ level: 1, name: "Battle Doctrine", summary: "No domains." }],
  },
  sophic: {
    id: "sophic",
    name: "Sophic",
    baseClassName: "Fighter",
    description: "Adds knowledge of magic to a fighter.",
    features: [
      {
        level: 1,
        name: "Student of Magic",
        summary: "Knowledge (arcana) becomes a class skill.",
      },
    ],
  },
  "roughneck-ranger": {
    id: "roughneck-ranger",
    name: "Roughneck Ranger",
    baseClassName: "Ranger",
    description: "Gives up spellcasting for trap tricks.",
    replaces: ["spellcasting"],
    features: [{ level: 4, name: "Bobby Trap", summary: "No spellcasting." }],
  },
  craftwright: {
    id: "craftwright",
    name: "Craftwright",
    baseClassName: "Alchemist",
    description: "Gets crafting feats over time.",
    features: [
      {
        level: 3,
        name: "Alchemical Craftsman",
        summary: "Gain Master Craftsman.",
      },
    ],
  },
  "phantom-warrior": {
    id: "phantom-warrior",
    name: "Phantom Warrior",
    baseClassName: "Spiritualist",
    description: "Trades spellcasting for martial features.",
    replaces: ["spellcasting"],
    features: [
      {
        level: 1,
        name: "Resolute Phantom",
        summary: "No normal spellcasting.",
      },
    ],
  },
  "covert-infiltrator": {
    id: "covert-infiltrator",
    name: "Covert Infiltrator",
    baseClassName: "Unchained Rogue",
    description: "Gets intel bonuses.",
    features: [
      {
        level: 1,
        name: "Intel",
        summary: "Half-level to knowledge and linguistics.",
      },
    ],
  },
  sharpscout: {
    id: "sharpscout",
    name: "Sharpscout",
    baseClassName: "Scout",
    description: "Gets a longbow proficiency exception.",
    features: [
      {
        level: 1,
        name: "Field Marksman",
        summary: "Gain longbow proficiency.",
      },
    ],
  },
};

const TEST_ARCHETYPE_RULE_CLASSES: ClassRegistry = {
  scout: {
    name: "Scout",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["ref"],
    skillRanksPerLevel: 6,
    classSkills: ["perception", "stealth", "survival"],
    weaponProficiencies: ["simple"],
  },
};

const CUSTOM_CLASSES: ClassRegistry = {
  alchemist: {
    name: "Alchemist",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["fort"],
    skillRanksPerLevel: 4,
    classSkills: ["craft", "knowledge.arcana", "spellcraft"],
    weaponProficiencies: ["simple"],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "int",
      spellsPerDay: {
        1: { 0: 2 },
        2: { 0: 3 },
        3: { 0: 3, 1: 1 },
        4: { 0: 4, 1: 2 },
        5: { 0: 4, 1: 2, 2: 1 },
      },
    },
  },
  spiritualist: {
    name: "Spiritualist",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["will"],
    skillRanksPerLevel: 4,
    classSkills: [
      "bluff",
      "intimidate",
      "knowledge.religion",
      "perception",
      "sense-motive",
    ],
    weaponProficiencies: ["simple"],
    spellcasting: {
      castingType: "spontaneous",
      castingAbility: "wis",
      spellsPerDay: {
        1: { 0: 3, 1: 1 },
        2: { 0: 4, 1: 2 },
      },
      spellsKnown: {
        1: { 0: 4, 1: 2 },
        2: { 0: 5, 1: 3 },
      },
    },
  },
  "unchained rogue": {
    name: "Unchained Rogue",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["ref"],
    skillRanksPerLevel: 8,
    classSkills: [
      "bluff",
      "disguise",
      "knowledge.local",
      "linguistics",
      "stealth",
    ],
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple"],
  },
};

function baseBuild(className: string): CharacterBuild {
  return {
    name: "Testy",
    race: { name: "Human", size: "medium", speed: 30, abilityModifiers: [] },
    baseAbilityScores: { str: 14, dex: 12, con: 12, int: 12, wis: 14, cha: 10 },
    levels: [{ className, hitPointRoll: 8 }],
  };
}

describe("archetype class overrides", () => {
  it("exports archetype rules from the public engine surface", () => {
    expect(ARCHETYPE_RULES["battle-chaplain"]?.disablesDomains).toBe(true);
  });

  it("removes battle chaplain domains from spellcasting output", () => {
    const build: CharacterBuild = {
      ...baseBuild("Cleric"),
      classArchetypes: { cleric: ["battle-chaplain"] },
      spellDomains: { cleric: ["war", "fire"] },
    };
    const sheet = computeSheet(
      buildCharacter(build, undefined, undefined, undefined, TEST_ARCHETYPES),
    );
    expect(sheet.spellcasting).toHaveLength(1);
    expect(sheet.spellcasting[0]?.domains).toEqual([]);
    expect(sheet.spellcasting[0]?.restrictedExtraSlotsPerDay).toEqual({
      0: 0,
      1: 0,
    });
    expect(sheet.spellcasting[0]?.grantedSpells).toEqual({});
    expect(sheet.descriptor.features.map((feature) => feature.name)).toContain(
      "Battle Doctrine",
    );
  });

  it("removes roughneck ranger spellcasting and shield proficiency", () => {
    const build: CharacterBuild = {
      ...baseBuild("Ranger"),
      classArchetypes: { ranger: ["roughneck-ranger"] },
      equipment: [
        {
          name: "Heavy Wooden Shield",
          equipped: true,
          slot: "shield",
          shield: { acBonus: 2, checkPenalty: 2 },
        },
      ],
      levels: [
        { className: "Ranger", hitPointRoll: 10 },
        { className: "Ranger", hitPointRoll: 6 },
        { className: "Ranger", hitPointRoll: 6 },
        { className: "Ranger", hitPointRoll: 6 },
      ],
    };
    const sheet = computeSheet(
      buildCharacter(build, undefined, undefined, undefined, TEST_ARCHETYPES),
    );
    const issues = validateBuild(build, undefined, undefined, TEST_ARCHETYPES);
    expect(sheet.spellcasting).toEqual([]);
    expect(issues.some((issue) => issue.code === "nonproficient-shield")).toBe(
      true,
    );
    expect(sheet.descriptor.features.map((feature) => feature.name)).toContain(
      "Bobby Trap",
    );
  });

  it("adds sophic class skills to level-up planning", () => {
    const build: CharacterBuild = {
      ...baseBuild("Fighter"),
      classArchetypes: { fighter: ["sophic"] },
    };
    const plan = planLevelUp(build, "Fighter", undefined, TEST_ARCHETYPES);
    expect(plan.classSkills).toContain("knowledge.arcana");
  });

  it("applies roughneck ranger alchemical aptitude as a scaling skill bonus", () => {
    const build: CharacterBuild = {
      ...baseBuild("Ranger"),
      classArchetypes: { ranger: ["roughneck-ranger"] },
      baseAbilityScores: {
        str: 14,
        dex: 12,
        con: 12,
        int: 12,
        wis: 14,
        cha: 10,
      },
      levels: [
        { className: "Ranger", hitPointRoll: 10, skillRanks: { craft: 1 } },
        { className: "Ranger", hitPointRoll: 6 },
        { className: "Ranger", hitPointRoll: 6 },
        { className: "Ranger", hitPointRoll: 6 },
      ],
    };
    const sheet = computeSheet(
      buildCharacter(build, undefined, undefined, undefined, TEST_ARCHETYPES),
    );
    expect(sheet.skills.craft?.total).toBe(7);
  });

  it("applies battle grace attack bonuses at cleric 10", () => {
    expect(
      ARCHETYPE_RULES["battle-chaplain"]?.modifierGrants?.some(
        (grant) => grant.valueScale === "half-wisdom-mod",
      ),
    ).toBe(true);
    const build: CharacterBuild = {
      ...baseBuild("Cleric"),
      classArchetypes: { cleric: ["battle-chaplain"] },
      baseAbilityScores: {
        str: 14,
        dex: 12,
        con: 12,
        int: 12,
        wis: 18,
        cha: 10,
      },
      levels: Array.from({ length: 10 }, () => ({
        className: "Cleric",
        hitPointRoll: 5,
      })),
    };
    const baseSheet = computeSheet(
      buildCharacter(
        { ...build, classArchetypes: {} },
        undefined,
        undefined,
        undefined,
        TEST_ARCHETYPES,
      ),
    );
    const archetypeSheet = computeSheet(
      buildCharacter(build, undefined, undefined, undefined, TEST_ARCHETYPES),
    );
    expect(
      archetypeSheet.attack.melee.total - baseSheet.attack.melee.total,
    ).toBe(4);
    expect(
      archetypeSheet.attack.ranged.total - baseSheet.attack.ranged.total,
    ).toBe(4);
  });

  it("auto-grants craftwright bonus feats onto the descriptor", () => {
    const build: CharacterBuild = {
      ...baseBuild("Alchemist"),
      classArchetypes: { alchemist: ["craftwright"] },
      levels: [
        { className: "Alchemist", hitPointRoll: 8 },
        { className: "Alchemist", hitPointRoll: 5 },
        { className: "Alchemist", hitPointRoll: 5 },
        { className: "Alchemist", hitPointRoll: 5 },
        { className: "Alchemist", hitPointRoll: 5 },
      ],
    };
    const sheet = computeSheet(
      buildCharacter(
        build,
        CUSTOM_CLASSES,
        undefined,
        undefined,
        TEST_ARCHETYPES,
      ),
    );
    expect(sheet.descriptor.feats.map((feat) => feat.name)).toEqual(
      expect.arrayContaining(["Master Craftsman", "Craft Construct"]),
    );
  });

  it("removes phantom warrior spellcasting from spiritualist builds", () => {
    const build: CharacterBuild = {
      ...baseBuild("Spiritualist"),
      classArchetypes: { spiritualist: ["phantom-warrior"] },
      levels: [
        { className: "Spiritualist", hitPointRoll: 8 },
        { className: "Spiritualist", hitPointRoll: 5 },
      ],
    };
    const sheet = computeSheet(
      buildCharacter(
        build,
        CUSTOM_CLASSES,
        undefined,
        undefined,
        TEST_ARCHETYPES,
      ),
    );
    expect(sheet.spellcasting).toEqual([]);
  });

  it("applies weapon-training-lite bonuses for phantom warrior at level 5", () => {
    expect(
      ARCHETYPE_RULES["phantom-warrior"]?.modifierGrants?.[0]?.valueScale,
    ).toBe("weapon-training-lite");
    const build: CharacterBuild = {
      ...baseBuild("Spiritualist"),
      classArchetypes: { spiritualist: ["phantom-warrior"] },
      levels: Array.from({ length: 5 }, () => ({
        className: "Spiritualist",
        hitPointRoll: 5,
      })),
    };
    const baseSheet = computeSheet(
      buildCharacter(
        { ...build, classArchetypes: {} },
        CUSTOM_CLASSES,
        undefined,
        undefined,
        TEST_ARCHETYPES,
      ),
    );
    const archetypeSheet = computeSheet(
      buildCharacter(
        build,
        CUSTOM_CLASSES,
        undefined,
        undefined,
        TEST_ARCHETYPES,
      ),
    );
    expect(
      archetypeSheet.attack.melee.total - baseSheet.attack.melee.total,
    ).toBe(1);
    expect(
      archetypeSheet.attack.ranged.total - baseSheet.attack.ranged.total,
    ).toBe(1);
  });

  it("applies covert infiltrator intel bonuses to knowledge and linguistics", () => {
    const build: CharacterBuild = {
      ...baseBuild("Unchained Rogue"),
      classArchetypes: { "unchained rogue": ["covert-infiltrator"] },
      baseAbilityScores: {
        str: 10,
        dex: 16,
        con: 12,
        int: 14,
        wis: 10,
        cha: 12,
      },
      levels: [
        {
          className: "Unchained Rogue",
          hitPointRoll: 8,
          skillRanks: { "knowledge.local": 1, linguistics: 1 },
        },
        { className: "Unchained Rogue", hitPointRoll: 5 },
        { className: "Unchained Rogue", hitPointRoll: 5 },
        { className: "Unchained Rogue", hitPointRoll: 5 },
      ],
    };
    const sheet = computeSheet(
      buildCharacter(
        build,
        CUSTOM_CLASSES,
        undefined,
        undefined,
        TEST_ARCHETYPES,
      ),
    );
    expect(sheet.skills["knowledge.local"]?.total).toBe(8);
    expect(sheet.skills.linguistics?.total).toBe(8);
    expect(sheet.skills["knowledge.arcana"]?.usable).toBe(true);
  });

  it("supports declarative specific weapon proficiencies from archetype rules", () => {
    expect(ARCHETYPE_RULES.sharpscout?.specificWeaponProficiencies).toEqual([
      "Longbow",
    ]);
    const build: CharacterBuild = {
      ...baseBuild("Scout"),
      classArchetypes: { scout: ["sharpscout"] },
      weapons: [
        {
          name: "Longbow",
          category: "ranged",
          proficiencyGroup: "martial",
          damageDice: "1d8",
          rangeIncrementFeet: 100,
          ammoType: "arrow",
          ammoPerAttack: 1,
          reloadType: "free",
        },
      ],
    };
    const issues = validateBuild(
      build,
      TEST_ARCHETYPE_RULE_CLASSES,
      undefined,
      TEST_ARCHETYPES,
    );
    expect(issues.some((issue) => issue.code === "nonproficient-weapon")).toBe(
      false,
    );
  });

  it("supports weapon-training-lite rule metadata for future archetypes", () => {
    expect(
      ARCHETYPE_RULES["skirmish-marauder"]?.modifierGrants?.[0]?.valueScale,
    ).toBe("weapon-training-lite");
  });
});
