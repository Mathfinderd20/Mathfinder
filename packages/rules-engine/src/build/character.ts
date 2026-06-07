import { abilityModifier } from "../abilities";
import type {
  AbilityKey,
  AbilityScores,
  CharacterInput,
  Modifier,
  Size,
  SkillKey,
} from "../types";
import {
  babForLevels,
  getClassDefinition,
  saveBaseForClass,
  SAMPLE_CLASSES,
  type ClassRegistry,
  type SaveKind,
} from "./classes";

/** A character's race choice and the mechanical effects it grants. */
export interface RaceChoice {
  name: string;
  size: Size;
  /** Base land speed in feet (default 30). */
  speed?: number;
  /** Racial ability adjustments, as `racial`-typed modifiers on ability scores. */
  abilityModifiers?: Modifier[];
  /** Other always-on racial traits (darkvision flavor aside, mechanical mods). */
  traits?: Modifier[];
  /** Skills the race always treats as class skills. */
  classSkills?: SkillKey[];
}

/** One level taken in the build (ordered; replay = current state). */
export interface LevelEntry {
  className: string;
  /** Hit die result for this level (level 1 is typically the die maximum). */
  hitPointRoll: number;
  /** Skill ranks allocated at this level. */
  skillRanks?: Partial<Record<SkillKey, number>>;
  feats?: string[];
  features?: string[];
  /** The +1 ability score increase granted at levels 4, 8, 12, ... */
  abilityIncrease?: AbilityKey;
  /** Favored-class reward chosen this level. */
  favoredClass?: "hp" | "skill";
  /** Mechanical effects gained this level (feats/features as modifiers). */
  modifiers?: Modifier[];
}

export interface EquipmentEntry {
  name: string;
  modifiers?: Modifier[];
  armor?: {
    maxDexBonus?: number;
    checkPenalty?: number;
    speedPenalty?: number;
  };
}

export interface CharacterBuild {
  name: string;
  race: RaceChoice;
  /** Point-buy / array result BEFORE racial adjustments and level increases. */
  baseAbilityScores: AbilityScores;
  levels: LevelEntry[];
  equipment?: EquipmentEntry[];
  /** Extra always-on modifiers (rarely needed; buffs are applied at runtime). */
  otherModifiers?: Modifier[];
}

const SAVES: readonly SaveKind[] = ["fort", "ref", "will"];

/** Append a level to a build, returning a NEW build (pure; enables undo). */
export function levelUp(build: CharacterBuild, entry: LevelEntry): CharacterBuild {
  return { ...build, levels: [...build.levels, entry] };
}

/** Remove the last level, returning a NEW build (the "undo" of levelUp). */
export function levelDown(build: CharacterBuild): CharacterBuild {
  return { ...build, levels: build.levels.slice(0, -1) };
}

/** Count how many levels were taken in each class. */
export function classLevelCounts(build: CharacterBuild): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lvl of build.levels) {
    const key = lvl.className.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Effective base ability scores (point-buy + permanent level increases). */
function effectiveBaseScores(build: CharacterBuild): AbilityScores {
  const scores: AbilityScores = { ...build.baseAbilityScores };
  for (const lvl of build.levels) {
    if (lvl.abilityIncrease) scores[lvl.abilityIncrease] += 1;
  }
  return scores;
}

/**
 * Replay a build into a normalized CharacterInput. This is the bridge between
 * the build/level-up layer and the pure derivation engine: buildCharacter()
 * produces the input, computeSheet() turns it into a sheet.
 */
export function buildCharacter(
  build: CharacterBuild,
  registry: ClassRegistry = SAMPLE_CLASSES,
): CharacterInput {
  const counts = classLevelCounts(build);
  const level = build.levels.length;

  // BAB + saves: sum each class's progression over its own level count.
  let baseAttackBonus = 0;
  const baseSaves: Record<SaveKind, number> = { fort: 0, ref: 0, will: 0 };
  const classSkillSet = new Set<SkillKey>(build.race.classSkills ?? []);

  for (const [className, count] of counts) {
    const def = getClassDefinition(registry, className);
    if (!def) continue; // validateBuild surfaces the error separately
    baseAttackBonus += babForLevels(def.bab, count);
    for (const save of SAVES) {
      baseSaves[save] += saveBaseForClass(def, count, save);
    }
    for (const skill of def.classSkills) classSkillSet.add(skill);
  }

  // Modifiers: race + traits + per-level + equipment + favored-class HP + other.
  const modifiers: Modifier[] = [
    ...(build.race.abilityModifiers ?? []),
    ...(build.race.traits ?? []),
  ];
  for (const lvl of build.levels) {
    if (lvl.modifiers) modifiers.push(...lvl.modifiers);
    if (lvl.favoredClass === "hp") {
      modifiers.push({ target: "hp", type: "untyped", value: 1, source: "Favored class" });
    }
  }

  // Equipment: aggregate armor cap / check penalty / speed penalty.
  let maxDexBonus: number | undefined;
  let armorCheckPenalty = 0;
  for (const item of build.equipment ?? []) {
    if (item.modifiers) modifiers.push(...item.modifiers);
    const armor = item.armor;
    if (!armor) continue;
    if (armor.maxDexBonus !== undefined) {
      maxDexBonus = maxDexBonus === undefined
        ? armor.maxDexBonus
        : Math.min(maxDexBonus, armor.maxDexBonus);
    }
    if (armor.checkPenalty) armorCheckPenalty += armor.checkPenalty;
    if (armor.speedPenalty) {
      modifiers.push({
        target: "speed",
        type: "untyped",
        value: -armor.speedPenalty,
        source: `${item.name} (armor)`,
      });
    }
  }
  if (build.otherModifiers) modifiers.push(...build.otherModifiers);

  // Skill ranks: sum allocations across levels.
  const skillRanks: Partial<Record<SkillKey, number>> = {};
  for (const lvl of build.levels) {
    if (!lvl.skillRanks) continue;
    for (const [key, ranks] of Object.entries(lvl.skillRanks) as [SkillKey, number][]) {
      skillRanks[key] = (skillRanks[key] ?? 0) + ranks;
    }
  }

  const rolledHitPoints = build.levels.map((l) => l.hitPointRoll);

  return {
    name: build.name,
    level,
    size: build.race.size,
    abilityScores: effectiveBaseScores(build),
    baseAttackBonus,
    baseSaves,
    maxDexBonus,
    armorCheckPenalty: armorCheckPenalty || undefined,
    baseSpeed: build.race.speed ?? 30,
    rolledHitPoints,
    classSkills: [...classSkillSet],
    skillRanks,
    modifiers,
  };
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  level?: number;
}

/**
 * Validate a build against the rules we can check without a full content DB:
 *   - every class taken must exist in the registry
 *   - ability increases only at levels 4, 8, 12, ...
 *   - per-skill total ranks may not exceed character level
 *   - per-level skill-point budget (soft warning)
 */
export function validateBuild(
  build: CharacterBuild,
  registry: ClassRegistry = SAMPLE_CLASSES,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const characterLevel = build.levels.length;

  const effInt = effectiveBaseScores(build).int +
    sumRacialAbility(build.race.abilityModifiers, "int");
  const intMod = abilityModifier(effInt);

  const runningRanks: Partial<Record<SkillKey, number>> = {};

  build.levels.forEach((lvl, index) => {
    const levelNum = index + 1;
    const def = getClassDefinition(registry, lvl.className);

    if (!def) {
      issues.push({
        severity: "error",
        code: "unknown-class",
        level: levelNum,
        message: `Unknown class "${lvl.className}" at level ${levelNum}.`,
      });
    }

    if (lvl.abilityIncrease && levelNum % 4 !== 0) {
      issues.push({
        severity: "error",
        code: "illegal-ability-increase",
        level: levelNum,
        message: `Ability score increase at level ${levelNum}; allowed only at levels 4, 8, 12, ...`,
      });
    }

    // Per-level skill-point budget (soft check).
    if (def && lvl.skillRanks) {
      const spent = Object.values(lvl.skillRanks).reduce<number>((s, n) => s + (n ?? 0), 0);
      const favoredSkill = lvl.favoredClass === "skill" ? 1 : 0;
      const budget = Math.max(1, def.skillRanksPerLevel + intMod) + favoredSkill;
      if (spent > budget) {
        issues.push({
          severity: "warning",
          code: "skill-points-over-budget",
          level: levelNum,
          message: `Level ${levelNum}: allocated ${spent} skill ranks but budget is ~${budget}.`,
        });
      }
    }

    // Per-skill rank cap = character level.
    if (lvl.skillRanks) {
      for (const [key, ranks] of Object.entries(lvl.skillRanks) as [SkillKey, number][]) {
        runningRanks[key] = (runningRanks[key] ?? 0) + ranks;
        if ((runningRanks[key] ?? 0) > levelNum) {
          issues.push({
            severity: "error",
            code: "skill-ranks-over-cap",
            level: levelNum,
            message: `Skill "${key}" has ${runningRanks[key]} ranks at level ${levelNum}; max is ${levelNum}.`,
          });
        }
      }
    }
  });

  // Final-state cap check against full character level (covers spread-out ranks).
  for (const [key, ranks] of Object.entries(runningRanks) as [SkillKey, number][]) {
    if ((ranks ?? 0) > characterLevel) {
      issues.push({
        severity: "error",
        code: "skill-ranks-over-cap",
        message: `Skill "${key}" totals ${ranks} ranks; character level is ${characterLevel}.`,
      });
    }
  }

  return issues;
}

function sumRacialAbility(mods: Modifier[] | undefined, ability: AbilityKey): number {
  if (!mods) return 0;
  return mods
    .filter((m) => m.target === ability)
    .reduce((sum, m) => sum + m.value, 0);
}
