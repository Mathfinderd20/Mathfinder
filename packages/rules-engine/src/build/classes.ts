import type { SkillKey } from "../types";

export type BabProgression = "full" | "three-quarter" | "half";
export type SaveKind = "fort" | "ref" | "will";

export interface ClassDefinition {
  name: string;
  hitDie: number;
  bab: BabProgression;
  goodSaves: SaveKind[];
  skillRanksPerLevel: number;
  classSkills: SkillKey[];
}

/** Base attack bonus contributed by `levels` levels of a given progression. */
export function babForLevels(progression: BabProgression, levels: number): number {
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

export function saveBaseForClass(def: ClassDefinition, levels: number, save: SaveKind): number {
  return def.goodSaves.includes(save) ? goodSaveBase(levels) : poorSaveBase(levels);
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
    classSkills: [
      "climb", "craft", "handle-animal", "intimidate",
      "knowledge.dungeoneering", "knowledge.engineering",
      "profession", "ride", "survival", "swim",
    ],
  },
  barbarian: {
    name: "Barbarian",
    hitDie: 12,
    bab: "full",
    goodSaves: ["fort"],
    skillRanksPerLevel: 4,
    classSkills: [
      "acrobatics", "climb", "craft", "handle-animal", "intimidate",
      "knowledge.nature", "perception", "ride", "survival", "swim",
    ],
  },
  rogue: {
    name: "Rogue",
    hitDie: 8,
    bab: "three-quarter",
    goodSaves: ["ref"],
    skillRanksPerLevel: 8,
    classSkills: [
      "acrobatics", "appraise", "bluff", "climb", "craft", "diplomacy",
      "disable-device", "disguise", "escape-artist", "intimidate",
      "knowledge.dungeoneering", "knowledge.local", "linguistics",
      "perception", "perform", "profession", "ride", "sense-motive",
      "sleight-of-hand", "stealth", "swim", "use-magic-device",
    ],
  },
};

export function getClassDefinition(
  registry: ClassRegistry,
  name: string,
): ClassDefinition | undefined {
  return registry[name.toLowerCase()];
}
