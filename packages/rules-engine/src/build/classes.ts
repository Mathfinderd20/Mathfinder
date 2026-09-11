import {
  FULL_DIVINE_SPELLS_PER_DAY,
  MARTIAL_DIVINE_SPELLS_PER_DAY,
} from "./divine-spell-progressions";
import type { Alignment } from "../alignment";
import {
  alignmentRestrictionsEnabled,
  type CampaignRules,
} from "../campaign-rules";
import { alignmentEthic, alignmentHasNeutralComponent } from "../alignment";
import type {
  AbilityKey,
  ArmorCategory,
  SkillKey,
  SpellAccess,
  SpellcastingType,
  WeaponProficiencyGroup,
} from "../types";

export type ArmorProficiency = Exclude<ArmorCategory, "none">;

export type BabProgression = "full" | "three-quarter" | "half";
export type SaveKind = "fort" | "ref" | "will";
export type ShieldProficiency = "shield" | "tower-shield";

export type ClassAlignmentRestriction =
  | { type: "exact"; alignment: Alignment; description: string }
  | { type: "nonlawful"; description: string }
  | { type: "neutral-component"; description: string };

export interface SpellcastingProgression {
  castingType: SpellcastingType;
  spellAccess?: SpellAccess;
  castingAbility: AbilityKey;
  spellsPerDay: Record<number, Partial<Record<number, number>>>;
  spellsKnown?: Record<number, Partial<Record<number, number>>>;
}

export type ClassPrerequisite =
  | {
      type: "bab" | "character-level";
      min: number;
      description: string;
    }
  | {
      type: "ability";
      ability: AbilityKey;
      min: number;
      description: string;
    }
  | {
      type: "feat";
      featName: string;
      description: string;
    }
  | {
      type: "skill-ranks";
      skill: SkillKey;
      min: number;
      description: string;
    }
  | {
      type: "class-levels";
      className: string;
      min: number;
      description: string;
    };

export interface ClassPrerequisiteContext {
  baseAttackBonus: number;
  abilityScores: Record<AbilityKey, number>;
  characterLevel: number;
  featNames: string[];
  skillRanks: Partial<Record<SkillKey, number>>;
  classLevels: Map<string, number>;
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
  isPrestigeClass?: boolean;
  alignmentRestriction?: ClassAlignmentRestriction;
  prerequisites?: ClassPrerequisite[];
}

export function classAllowsAlignment(
  classDef: ClassDefinition,
  alignment: Alignment | undefined,
  campaignRules?: CampaignRules | null,
): boolean {
  if (!alignmentRestrictionsEnabled(campaignRules)) return true;
  const restriction = classDef.alignmentRestriction;
  if (!restriction || !alignment) return true;
  switch (restriction.type) {
    case "exact":
      return alignment === restriction.alignment;
    case "nonlawful":
      return alignmentEthic(alignment) !== "lawful";
    case "neutral-component":
      return alignmentHasNeutralComponent(alignment);
  }
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

function normalizeChosenFeatBaseName(name: string): string {
  const trimmed = name.trim();
  const match = /^(.*?)\s*\(.+\)\s*$/.exec(trimmed);
  return (match?.[1] ?? trimmed).trim().toLowerCase();
}

export function checkClassPrerequisites(
  classDef: ClassDefinition,
  ctx: ClassPrerequisiteContext,
): ClassPrerequisite[] {
  return (classDef.prerequisites ?? []).filter((prereq) => {
    switch (prereq.type) {
      case "bab":
        return ctx.baseAttackBonus < prereq.min;
      case "character-level":
        return ctx.characterLevel < prereq.min;
      case "ability":
        return ctx.abilityScores[prereq.ability] < prereq.min;
      case "feat": {
        const wanted = prereq.featName.trim().toLowerCase();
        return !ctx.featNames.some(
          (name) => normalizeChosenFeatBaseName(name) === wanted,
        );
      }
      case "skill-ranks":
        return (ctx.skillRanks[prereq.skill] ?? 0) < prereq.min;
      case "class-levels":
        return (
          (ctx.classLevels.get(prereq.className.trim().toLowerCase()) ?? 0) <
          prereq.min
        );
    }
  });
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
    alignmentRestriction: {
      type: "nonlawful",
      description: "Barbarians must be nonlawful.",
    },
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
      spellAccess: "spellbook",
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
      spellAccess: "full-list",
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: FULL_DIVINE_SPELLS_PER_DAY,
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
      spellAccess: "limited-known",
      castingType: "spontaneous",
      castingAbility: "cha",
      spellsPerDay: {
        1: spellsByLevel(5, 3),
        2: spellsByLevel(6, 4),
        3: spellsByLevel(6, 5),
        4: spellsByLevel(6, 6, 3),
        5: spellsByLevel(6, 6, 4),
        6: spellsByLevel(7, 6, 5, 3),
        7: spellsByLevel(7, 6, 6, 4),
        8: spellsByLevel(8, 6, 6, 5, 3),
        9: spellsByLevel(8, 6, 6, 6, 4),
        10: spellsByLevel(9, 6, 6, 6, 5, 3),
        11: spellsByLevel(9, 6, 6, 6, 6, 4),
        12: spellsByLevel(9, 6, 6, 6, 6, 5, 3),
        13: spellsByLevel(9, 6, 6, 6, 6, 6, 4),
        14: spellsByLevel(9, 6, 6, 6, 6, 6, 5, 3),
        15: spellsByLevel(9, 6, 6, 6, 6, 6, 6, 4),
        16: spellsByLevel(9, 6, 6, 6, 6, 6, 6, 5, 3),
        17: spellsByLevel(9, 6, 6, 6, 6, 6, 6, 6, 4),
        18: spellsByLevel(9, 6, 6, 6, 6, 6, 6, 6, 5, 3),
        19: spellsByLevel(9, 6, 6, 6, 6, 6, 6, 6, 6, 4),
        20: spellsByLevel(9, 6, 6, 6, 6, 6, 6, 6, 6, 6),
      },
      spellsKnown: {
        1: spellsByLevel(4, 2),
        2: spellsByLevel(5, 2),
        3: spellsByLevel(5, 3),
        4: spellsByLevel(6, 3, 1),
        5: spellsByLevel(6, 4, 2),
        6: spellsByLevel(7, 4, 2, 1),
        7: spellsByLevel(7, 5, 3, 2),
        8: spellsByLevel(8, 5, 3, 2, 1),
        9: spellsByLevel(8, 5, 4, 3, 2),
        10: spellsByLevel(9, 5, 4, 3, 2, 1),
        11: spellsByLevel(9, 5, 5, 4, 3, 2),
        12: spellsByLevel(9, 5, 5, 4, 3, 2, 1),
        13: spellsByLevel(9, 5, 5, 4, 4, 3, 2),
        14: spellsByLevel(9, 5, 5, 4, 4, 3, 2, 1),
        15: spellsByLevel(9, 5, 5, 4, 4, 4, 3, 2),
        16: spellsByLevel(9, 5, 5, 4, 4, 4, 3, 2, 1),
        17: spellsByLevel(9, 5, 5, 4, 4, 4, 3, 3, 2),
        18: spellsByLevel(9, 5, 5, 4, 4, 4, 3, 3, 2, 1),
        19: spellsByLevel(9, 5, 5, 4, 4, 4, 3, 3, 3, 2),
        20: spellsByLevel(9, 5, 5, 4, 4, 4, 3, 3, 3, 3),
      },
    },
  },
  druid: {
    name: "Druid",
    alignmentRestriction: {
      type: "neutral-component",
      description: "Druids must have at least one neutral alignment component.",
    },
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
      spellAccess: "full-list",
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: FULL_DIVINE_SPELLS_PER_DAY,
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
      spellAccess: "limited-known",
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
      spellAccess: "full-list",
      castingType: "prepared",
      castingAbility: "wis",
      spellsPerDay: MARTIAL_DIVINE_SPELLS_PER_DAY,
    },
  },
  paladin: {
    name: "Paladin",
    alignmentRestriction: {
      type: "exact",
      alignment: "lawful-good",
      description: "Paladins must be lawful good.",
    },
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
      spellAccess: "full-list",
      castingType: "prepared",
      castingAbility: "cha",
      spellsPerDay: MARTIAL_DIVINE_SPELLS_PER_DAY,
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
      spellAccess: "limited-known",
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
  const definition = registry[name.toLowerCase()];
  return definition ? completeCoreSpellProgression(definition) : undefined;
}

/** Older exported catalogs contain abbreviated core progressions. Preserve
 * explicit catalog rows except for the recognized legacy divine placeholders.
 * Source: https://legacy.aonprd.com/coreRuleBook/classes/sorcerer.html
 */
export function completeCoreSpellProgression(
  definition: ClassDefinition,
): ClassDefinition {
  const key = definition.name.toLowerCase();
  if (
    !definition.spellcasting ||
    !["sorcerer", "cleric", "druid", "paladin", "ranger"].includes(key)
  )
    return definition;
  const core = SAMPLE_CLASSES[key]!.spellcasting!;
  const source = definition.spellcasting;
  if (source.castingType !== core.castingType) return definition;
  const legacyRows: Record<
    string,
    Record<number, Partial<Record<number, number>>>
  > = {
    cleric: { 4: { 0: 5, 1: 3, 2: 2 }, 5: { 0: 5, 1: 3, 2: 2, 3: 1 } },
    druid: { 4: { 0: 5, 1: 3, 2: 2 }, 5: { 0: 5, 1: 3, 2: 2, 3: 1 } },
    ranger: { 4: { 1: 1 }, 5: { 1: 2 } },
    paladin: { 4: { 3: 1 }, 5: { 3: 1 } },
  };
  const spellsPerDay = { ...core.spellsPerDay, ...source.spellsPerDay };
  if (!source.spellAccess) {
    for (const [level, oldRow] of Object.entries(legacyRows[key] ?? {})) {
      const row = source.spellsPerDay[Number(level)];
      if (
        row &&
        Object.keys(row).length === Object.keys(oldRow).length &&
        Object.entries(oldRow).every(
          ([spellLevel, slots]) => row[Number(spellLevel)] === slots,
        )
      ) {
        spellsPerDay[Number(level)] = core.spellsPerDay[Number(level)]!;
      }
    }
  }
  return {
    ...definition,
    spellcasting: {
      ...source,
      spellAccess: source.spellAccess ?? core.spellAccess,
      spellsPerDay,
      spellsKnown: {
        ...core.spellsKnown,
        ...definition.spellcasting.spellsKnown,
      },
    },
  };
}
