import type {
  AbilityKey,
  ArmorCategory,
  SkillKey,
  SpellcastingType,
  WeaponProficiencyGroup,
} from "../types";

export type ArmorProficiency = Exclude<ArmorCategory, "none">;

export type BabProgression = "full" | "three-quarter" | "half";
export type SaveKind = "fort" | "ref" | "will";
export type ShieldProficiency = "shield" | "tower-shield";

export interface SpellcastingProgression {
  castingType: SpellcastingType;
  castingAbility: AbilityKey;
  spellsPerDay: Record<number, Partial<Record<number, number>>>;
  spellsKnown?: Record<number, Partial<Record<number, number>>>;
}

export interface ClassDefinition {
  name: string;
  hitDie: number;
  bab: BabProgression;
  goodSaves: SaveKind[];
  skillRanksPerLevel: number;
  classSkills: SkillKey[];
  armorProficiencies?: ArmorProficiency[];
  shieldProficiencies?: ShieldProficiency[];
  weaponProficiencies?: WeaponProficiencyGroup[];
  specificWeaponProficiencies?: string[];
  spellcasting?: SpellcastingProgression;
}

/** Base attack bonus contributed by `levels` levels of a given progression. */
export function babForLevels(
  progression: BabProgression,
  levels: number,
): number {
  if (levels <= 0) return 0;
  switch (progression) {
    case "full":
      return levels;
    case "three-quarter":
      return Math.floor((levels * 3) / 4);
    case "half":
      return Math.floor(levels / 2);
  }
}

/** Good-save base bonus for `levels` levels in a single class. */
export function goodSaveBase(levels: number): number {
  return levels <= 0 ? 0 : 2 + Math.floor(levels / 2);
}

/** Poor-save base bonus for `levels` levels in a single class. */
export function poorSaveBase(levels: number): number {
  return levels <= 0 ? 0 : Math.floor(levels / 3);
}

export function saveBaseForClass(
  def: ClassDefinition,
  levels: number,
  save: SaveKind,
): number {
  return def.goodSaves.includes(save)
    ? goodSaveBase(levels)
    : poorSaveBase(levels);
}

export function spellsByLevel(
  ...slots: Array<number | undefined>
): Partial<Record<number, number>> {
  const out: Partial<Record<number, number>> = {};
  slots.forEach((count, spellLevel) => {
    if ((count ?? 0) > 0) out[spellLevel] = count;
  });
  return out;
}

export type ClassRegistry = Record<string, ClassDefinition>;

/**
 * Illustrative core-style classes so the build engine works end-to-end today.
 * Real Paizo + Savage Company classes will replace these when the content pack
 * lands; the build math (`buildCharacter`) does not change.
 */
export const SAMPLE_CLASSES: ClassRegistry = {
  fighter: {
    name: "Fighter",
    hitDie: 10,
    bab: "full",
    goodSaves: ["fort"],
    skillRanksPerLevel: 2,
    armorProficiencies: ["light", "medium", "heavy"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple", "martial"],
    classSkills: [
      "climb",
      "craft",
      "handle-animal",
      "intimidate",
      "knowledge.dungeoneering",
      "knowledge.engineering",
      "profession",
      "ride",
      "survival",
      "swim",
    ],
  },
  barbarian: {
    name: "Barbarian",
    hitDie: 12,
    bab: "full",
    goodSaves: ["fort"],
    skillRanksPerLevel: 4,
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple", "martial"],
    classSkills: [
      "acrobatics",
      "climb",
      "craft",
      "handle-animal",
      "intimidate",
      "knowledge.nature",
      "perception",
      "ride",
      "survival",
      "swim",
    ],
  },
  rogue: {
    name: "Rogue",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["ref"],
    skillRanksPerLevel: 8,
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple"],
    specificWeaponProficiencies: [
      "hand crossbow",
      "rapier",
      "sap",
      "shortbow",
      "short sword",
    ],
    classSkills: [
      "acrobatics",
      "appraise",
      "bluff",
      "climb",
      "craft",
      "diplomacy",
      "disable-device",
      "disguise",
      "escape-artist",
      "intimidate",
      "knowledge.dungeoneering",
      "knowledge.local",
      "linguistics",
      "perception",
      "perform",
      "profession",
      "ride",
      "sense-motive",
      "sleight-of-hand",
      "stealth",
      "swim",
      "use-magic-device",
    ],
  },
  wizard: {
    name: "Wizard",
    hitDie: 6,
    bab: "half",
    goodSaves: ["will"],
    skillRanksPerLevel: 2,
    weaponProficiencies: ["simple"],
    specificWeaponProficiencies: [
      "club",
      "dagger",
      "heavy crossbow",
      "light crossbow",
      "quarterstaff",
    ],
    classSkills: [
      "appraise",
      "craft",
      "fly",
      "knowledge.arcana",
      "knowledge.dungeoneering",
      "knowledge.engineering",
      "knowledge.geography",
      "knowledge.history",
      "knowledge.local",
      "knowledge.nature",
      "knowledge.nobility",
      "knowledge.planes",
      "knowledge.religion",
      "linguistics",
      "profession",
      "spellcraft",
    ],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "int",
      spellsPerDay: {
        1: spellsByLevel(3, 1),
        2: spellsByLevel(4, 2),
        3: spellsByLevel(4, 2, 1),
        4: spellsByLevel(4, 3, 2),
        5: spellsByLevel(4, 3, 2, 1),
      },
    },
  },
  cleric: {
    name: "Cleric",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["fort", "will"],
    skillRanksPerLevel: 2,
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple"],
    classSkills: [
      "appraise",
      "craft",
      "diplomacy",
      "heal",
      "knowledge.arcana",
      "knowledge.history",
      "knowledge.nobility",
      "knowledge.planes",
      "knowledge.religion",
      "linguistics",
      "profession",
      "sense-motive",
      "spellcraft",
    ],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: {
        1: spellsByLevel(3, 1),
        2: spellsByLevel(4, 2),
        3: spellsByLevel(4, 2, 1),
        4: spellsByLevel(5, 3, 2),
        5: spellsByLevel(5, 3, 2, 1),
      },
    },
  },
  sorcerer: {
    name: "Sorcerer",
    hitDie: 6,
    bab: "half",
    goodSaves: ["will"],
    skillRanksPerLevel: 2,
    weaponProficiencies: ["simple"],
    classSkills: [
      "appraise",
      "bluff",
      "craft",
      "fly",
      "intimidate",
      "knowledge.arcana",
      "profession",
      "spellcraft",
      "use-magic-device",
    ],
    spellcasting: {
      castingType: "spontaneous",
      castingAbility: "cha",
      spellsPerDay: {
        1: spellsByLevel(5, 3),
        2: spellsByLevel(6, 4),
        3: spellsByLevel(6, 5),
        4: spellsByLevel(6, 6, 3),
        5: spellsByLevel(6, 6, 4),
      },
      spellsKnown: {
        1: spellsByLevel(4, 2),
        2: spellsByLevel(5, 2),
        3: spellsByLevel(5, 3),
        4: spellsByLevel(6, 3, 1),
        5: spellsByLevel(6, 4, 2),
      },
    },
  },
  druid: {
    name: "Druid",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["fort", "will"],
    skillRanksPerLevel: 4,
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple"],
    specificWeaponProficiencies: [
      "club",
      "dagger",
      "dart",
      "quarterstaff",
      "scimitar",
      "scythe",
      "shortspear",
      "sling",
      "spear",
    ],
    classSkills: [
      "climb",
      "craft",
      "fly",
      "handle-animal",
      "heal",
      "knowledge.geography",
      "knowledge.nature",
      "perception",
      "profession",
      "ride",
      "spellcraft",
      "survival",
      "swim",
    ],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: {
        1: spellsByLevel(3, 1),
        2: spellsByLevel(4, 2),
        3: spellsByLevel(4, 2, 1),
        4: spellsByLevel(5, 3, 2),
        5: spellsByLevel(5, 3, 2, 1),
      },
    },
  },
  bard: {
    name: "Bard",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["ref", "will"],
    skillRanksPerLevel: 6,
    armorProficiencies: ["light"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple"],
    specificWeaponProficiencies: [
      "longsword",
      "rapier",
      "sap",
      "short sword",
      "shortbow",
      "whip",
    ],
    classSkills: [
      "acrobatics",
      "appraise",
      "bluff",
      "climb",
      "craft",
      "diplomacy",
      "disguise",
      "escape-artist",
      "intimidate",
      "knowledge.arcana",
      "knowledge.dungeoneering",
      "knowledge.engineering",
      "knowledge.geography",
      "knowledge.history",
      "knowledge.local",
      "knowledge.nature",
      "knowledge.nobility",
      "knowledge.planes",
      "knowledge.religion",
      "linguistics",
      "perception",
      "perform",
      "profession",
      "sense-motive",
      "sleight-of-hand",
      "spellcraft",
      "stealth",
      "use-magic-device",
    ],
    spellcasting: {
      castingType: "spontaneous",
      castingAbility: "cha",
      spellsPerDay: {
        1: spellsByLevel(4, 2),
        2: spellsByLevel(5, 3),
        3: spellsByLevel(6, 4),
        4: spellsByLevel(6, 4, 2),
        5: spellsByLevel(6, 4, 3),
      },
      spellsKnown: {
        1: spellsByLevel(4, 2),
        2: spellsByLevel(5, 3),
        3: spellsByLevel(6, 4),
        4: spellsByLevel(6, 4, 2),
        5: spellsByLevel(6, 5, 3),
      },
    },
  },
  ranger: {
    name: "Ranger",
    hitDie: 10,
    bab: "full",
    goodSaves: ["fort", "ref"],
    skillRanksPerLevel: 6,
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple", "martial"],
    classSkills: [
      "climb",
      "craft",
      "handle-animal",
      "heal",
      "intimidate",
      "knowledge.dungeoneering",
      "knowledge.geography",
      "knowledge.nature",
      "perception",
      "profession",
      "ride",
      "spellcraft",
      "stealth",
      "survival",
      "swim",
    ],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: {
        4: spellsByLevel(undefined, 1),
        5: spellsByLevel(undefined, 2),
      },
    },
  },
  paladin: {
    name: "Paladin",
    hitDie: 10,
    bab: "full",
    goodSaves: ["fort", "will"],
    skillRanksPerLevel: 2,
    armorProficiencies: ["light", "medium", "heavy"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple", "martial"],
    classSkills: [
      "craft",
      "diplomacy",
      "handle-animal",
      "heal",
      "knowledge.nobility",
      "knowledge.religion",
      "profession",
      "ride",
      "sense-motive",
      "spellcraft",
    ],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: {
        4: spellsByLevel(undefined, 1),
        5: spellsByLevel(undefined, 2),
      },
    },
  },
  inquisitor: {
    name: "Inquisitor",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["fort", "will"],
    skillRanksPerLevel: 6,
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple"],
    classSkills: [
      "bluff",
      "climb",
      "craft",
      "diplomacy",
      "disguise",
      "handle-animal",
      "heal",
      "intimidate",
      "knowledge.arcana",
      "knowledge.dungeoneering",
      "knowledge.nature",
      "knowledge.planes",
      "knowledge.religion",
      "perception",
      "profession",
      "ride",
      "sense-motive",
      "spellcraft",
      "stealth",
      "survival",
      "swim",
    ],
    spellcasting: {
      castingType: "spontaneous",
      castingAbility: "wis",
      spellsPerDay: {
        1: spellsByLevel(undefined, 1),
        2: spellsByLevel(undefined, 2),
        3: spellsByLevel(undefined, 3),
        4: spellsByLevel(undefined, 3, 1),
        5: spellsByLevel(undefined, 4, 2),
      },
      spellsKnown: {
        1: spellsByLevel(undefined, 2),
        2: spellsByLevel(undefined, 3),
        3: spellsByLevel(undefined, 4),
        4: spellsByLevel(undefined, 4, 2),
        5: spellsByLevel(undefined, 5, 3),
      },
    },
  },
};

export function getClassDefinition(
  registry: ClassRegistry,
  name: string,
): ClassDefinition | undefined {
  return registry[name.toLowerCase()];
}
