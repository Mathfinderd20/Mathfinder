import { resolveModifiers } from "./modifiers";
import type {
  AbilityKey,
  BreakdownEntry,
  CharacterInput,
  DerivedAbility,
  DerivedSkill,
  Modifier,
  SkillDefinition,
  SkillKey,
} from "./types";

const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Bonus granted to a class skill once at least one rank is invested. */
export const CLASS_SKILL_BONUS = 3;

/**
 * The standard Pathfinder 1e skill list. Knowledge subtypes are discrete
 * entries; Craft/Perform/Profession are single generic entries (specialized
 * via the character's chosen focus at a higher layer).
 */
export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  { key: "acrobatics", name: "Acrobatics", ability: "dex", trainedOnly: false, armorCheckPenalty: true },
  { key: "appraise", name: "Appraise", ability: "int", trainedOnly: false, armorCheckPenalty: false },
  { key: "bluff", name: "Bluff", ability: "cha", trainedOnly: false, armorCheckPenalty: false },
  { key: "climb", name: "Climb", ability: "str", trainedOnly: false, armorCheckPenalty: true },
  { key: "craft", name: "Craft", ability: "int", trainedOnly: false, armorCheckPenalty: false },
  { key: "diplomacy", name: "Diplomacy", ability: "cha", trainedOnly: false, armorCheckPenalty: false },
  { key: "disable-device", name: "Disable Device", ability: "dex", trainedOnly: true, armorCheckPenalty: true },
  { key: "disguise", name: "Disguise", ability: "cha", trainedOnly: false, armorCheckPenalty: false },
  { key: "escape-artist", name: "Escape Artist", ability: "dex", trainedOnly: false, armorCheckPenalty: true },
  { key: "fly", name: "Fly", ability: "dex", trainedOnly: false, armorCheckPenalty: true },
  { key: "handle-animal", name: "Handle Animal", ability: "cha", trainedOnly: true, armorCheckPenalty: false },
  { key: "heal", name: "Heal", ability: "wis", trainedOnly: false, armorCheckPenalty: false },
  { key: "intimidate", name: "Intimidate", ability: "cha", trainedOnly: false, armorCheckPenalty: false },
  { key: "knowledge.arcana", name: "Knowledge (arcana)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.dungeoneering", name: "Knowledge (dungeoneering)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.engineering", name: "Knowledge (engineering)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.geography", name: "Knowledge (geography)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.history", name: "Knowledge (history)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.local", name: "Knowledge (local)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.nature", name: "Knowledge (nature)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.nobility", name: "Knowledge (nobility)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.planes", name: "Knowledge (planes)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "knowledge.religion", name: "Knowledge (religion)", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "linguistics", name: "Linguistics", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "perception", name: "Perception", ability: "wis", trainedOnly: false, armorCheckPenalty: false },
  { key: "perform", name: "Perform", ability: "cha", trainedOnly: false, armorCheckPenalty: false },
  { key: "profession", name: "Profession", ability: "wis", trainedOnly: true, armorCheckPenalty: false },
  { key: "ride", name: "Ride", ability: "dex", trainedOnly: false, armorCheckPenalty: true },
  { key: "sense-motive", name: "Sense Motive", ability: "wis", trainedOnly: false, armorCheckPenalty: false },
  { key: "sleight-of-hand", name: "Sleight of Hand", ability: "dex", trainedOnly: true, armorCheckPenalty: true },
  { key: "spellcraft", name: "Spellcraft", ability: "int", trainedOnly: true, armorCheckPenalty: false },
  { key: "stealth", name: "Stealth", ability: "dex", trainedOnly: false, armorCheckPenalty: true },
  { key: "survival", name: "Survival", ability: "wis", trainedOnly: false, armorCheckPenalty: false },
  { key: "swim", name: "Swim", ability: "str", trainedOnly: false, armorCheckPenalty: true },
  { key: "use-magic-device", name: "Use Magic Device", ability: "cha", trainedOnly: true, armorCheckPenalty: false },
];

/** Collect modifiers targeting a specific skill plus the "skill.all" group. */
function skillModifiers(mods: Modifier[], key: SkillKey): Modifier[] {
  return mods.filter(
    (m) => m.enabled !== false && (m.target === `skill.${key}` || m.target === "skill.all"),
  );
}

/**
 * Derive every standard skill:
 *   total = ranks + ability mod + class-skill bonus + misc - armor check penalty
 */
export function deriveSkills(
  input: CharacterInput,
  abilities: Record<AbilityKey, DerivedAbility>,
): Record<SkillKey, DerivedSkill> {
  const classSkills = new Set(input.classSkills ?? []);
  const acp = input.armorCheckPenalty ?? 0;
  const result = {} as Record<SkillKey, DerivedSkill>;

  for (const def of SKILL_DEFINITIONS) {
    const ranks = input.skillRanks?.[def.key] ?? 0;
    const isClassSkill = classSkills.has(def.key);
    const abilityMod = abilities[def.ability].mod;
    const misc = resolveModifiers(skillModifiers(input.modifiers, def.key));

    const breakdown: BreakdownEntry[] = [];
    if (ranks !== 0) breakdown.push({ source: "ranks", type: "base", value: ranks });
    breakdown.push({ source: ABILITY_LABEL[def.ability], type: "ability", value: abilityMod });
    if (isClassSkill && ranks > 0) {
      breakdown.push({ source: "class skill", type: "untyped", value: CLASS_SKILL_BONUS });
    }
    for (const m of misc.contributing) {
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }
    if (def.armorCheckPenalty && acp !== 0) {
      breakdown.push({ source: "armor check penalty", type: "penalty", value: -acp });
    }

    const total = breakdown.reduce((sum, entry) => sum + entry.value, 0);

    result[def.key] = {
      key: def.key,
      name: def.name,
      ability: def.ability,
      ranks,
      isClassSkill,
      trainedOnly: def.trainedOnly,
      usable: !def.trainedOnly || ranks > 0,
      total,
      breakdown,
    };
  }

  return result;
}
