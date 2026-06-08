import { abilityModifier } from "../abilities";
import type {
  AbilityKey,
  AbilityScores,
  CharacterInput,
  Condition,
  Modifier,
  NamedAcquisition,
  SheetDescriptor,
  Size,
  SkillKey,
  SuppressedAcquisition,
  Weapon,
} from "../types";
import {
  babForLevels,
  getClassDefinition,
  saveBaseForClass,
  SAMPLE_CLASSES,
  type ClassRegistry,
  type SaveKind,
} from "./classes";
import { featEffects, FEATS, type FeatRegistry } from "../content/feats";
import {
  classFeatureEffects,
  classFeaturesGrantedAt,
  suppressedClassFeatures,
  CLASS_FEATURES,
  type ClassFeatureRegistry,
} from "../content/class-features";
import { deriveEncumbrance } from "../encumbrance";

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
  quantity?: number;
  weight?: number;
  costGp?: number;
  equipped?: boolean;
  modifiers?: Modifier[];
  armor?: {
    category?: "light" | "medium" | "heavy";
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
  weapons?: Weapon[];
  /** Current character conditions, e.g. fatigued. */
  conditions?: Condition[];
  /** Total carried load in pounds for encumbrance. */
  carriedWeight?: number;
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

function equipmentQuantity(item: EquipmentEntry): number {
  return item.quantity ?? 1;
}

function sumEquipmentWeight(equipment: EquipmentEntry[] | undefined): number {
  return (equipment ?? []).reduce((sum, item) => sum + (item.weight ?? 0) * equipmentQuantity(item), 0);
}

function inventorySummary(equipment: EquipmentEntry[] | undefined) {
  const items = equipment ?? [];
  return {
    itemCount: items.reduce((sum, item) => sum + equipmentQuantity(item), 0),
    equippedCount: items.filter((item) => item.equipped).reduce((sum, item) => sum + equipmentQuantity(item), 0),
    totalWeight: sumEquipmentWeight(items),
    totalCostGp: items.reduce((sum, item) => sum + (item.costGp ?? 0) * equipmentQuantity(item), 0),
  };
}

/**
 * Replay a build into a normalized CharacterInput. This is the bridge between
 * the build/level-up layer and the pure derivation engine: buildCharacter()
 * produces the input, computeSheet() turns it into a sheet.
 */
export function buildCharacter(
  build: CharacterBuild,
  registry: ClassRegistry = SAMPLE_CLASSES,
  featRegistry: FeatRegistry = FEATS,
  classFeatureRegistry: ClassFeatureRegistry = CLASS_FEATURES,
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

  // Equipment-derived legality context.
  let armorCategory: "none" | "light" | "medium" | "heavy" = "none";
  for (const item of build.equipment ?? []) {
    const cat = item.armor?.category;
    if (cat === "heavy") armorCategory = "heavy";
    else if (cat === "medium" && armorCategory !== "heavy") armorCategory = "medium";
    else if (cat === "light" && armorCategory === "none") armorCategory = "light";
  }
  const baseScores = effectiveBaseScores(build);
  const baseStr = baseScores.str + sumRacialAbility(build.race.abilityModifiers, "str");
  const equipmentInventory = inventorySummary(build.equipment);
  const carriedWeight = build.carriedWeight ?? equipmentInventory.totalWeight;
  const encumbrance = deriveEncumbrance(baseStr, carriedWeight);

  const classProgress = new Map<string, number>();
  const autoGrantedFeatures: NamedAcquisition[] = [];
  const autoSuppressedFeatures: SuppressedAcquisition[] = [];
  let characterLevelIndex = 0;
  for (const lvl of build.levels) {
    characterLevelIndex += 1;
    const classKey = lvl.className.toLowerCase();
    const classLevel = (classProgress.get(classKey) ?? 0) + 1;
    classProgress.set(classKey, classLevel);

    const granted = classFeaturesGrantedAt(classFeatureRegistry, lvl.className, classLevel);
    for (const g of granted) autoGrantedFeatures.push({ name: g.name, level: characterLevelIndex });

    const featureCtx = {
      armorCategory,
      loadBand: encumbrance.band,
      conditions: build.conditions ?? [],
    };
    for (const s of suppressedClassFeatures(granted, featureCtx)) {
      autoSuppressedFeatures.push({ name: s.name, level: characterLevelIndex, reason: s.reason });
    }

    if (lvl.modifiers) modifiers.push(...lvl.modifiers);
    if (lvl.feats) modifiers.push(...featEffects(lvl.feats, featRegistry));
    modifiers.push(...classFeatureEffects(granted, featureCtx));
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

  // Descriptor: race, class breakdown, and feats/features with the level gained.
  const feats: NamedAcquisition[] = [];
  const features: NamedAcquisition[] = [...autoGrantedFeatures];
  build.levels.forEach((lvl, index) => {
    const levelNum = index + 1;
    for (const feat of lvl.feats ?? []) feats.push({ name: feat, level: levelNum });
    for (const feature of lvl.features ?? []) features.push({ name: feature, level: levelNum });
  });
  const classes: NamedAcquisition[] = [];
  for (const [className, count] of counts) {
    const def = getClassDefinition(registry, className);
    classes.push({ name: def?.name ?? className, level: count });
  }
  const dedupeAcquisitions = (items: NamedAcquisition[]): NamedAcquisition[] => {
    const seen = new Set<string>();
    const out: NamedAcquisition[] = [];
    for (const item of items) {
      const key = `${item.level}::${item.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };
  const dedupeSuppressed = (items: SuppressedAcquisition[]): SuppressedAcquisition[] => {
    const seen = new Set<string>();
    const out: SuppressedAcquisition[] = [];
    for (const item of items) {
      const key = `${item.level}::${item.name.toLowerCase()}::${item.reason.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };
  const descriptor: SheetDescriptor = {
    race: build.race.name,
    classes,
    feats: dedupeAcquisitions(feats),
    features: dedupeAcquisitions(features),
    suppressedFeatures: dedupeSuppressed(autoSuppressedFeatures),
  };

  return {
    descriptor,
    name: build.name,
    level,
    size: build.race.size,
    abilityScores: effectiveBaseScores(build),
    baseAttackBonus,
    baseSaves,
    armorCategory,
    carriedWeight,
    inventory: equipmentInventory,
    maxDexBonus,
    armorCheckPenalty: armorCheckPenalty || undefined,
    baseSpeed: build.race.speed ?? 30,
    rolledHitPoints,
    classSkills: [...classSkillSet],
    skillRanks,
    weapons: build.weapons,
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

// ---------------------------------------------------------------------------
// Level-up planning: what choices does the NEXT level grant the player?
// ---------------------------------------------------------------------------

export interface LevelUpPlan {
  /** The character level this level-up produces. */
  characterLevel: number;
  className: string;
  hitDie: number;
  /** Suggested HP using the common (die/2)+1 average. */
  averageHitPoints: number;
  /** Skill ranks to allocate this level (class base + Int mod, min 1). */
  skillPoints: number;
  /** Max total ranks any single skill may have (= character level). */
  maxRanksPerSkill: number;
  /** Standard feat progression: a feat at levels 1, 3, 5, 7, ... */
  grantsFeat: boolean;
  /** A +1 ability score increase at levels 4, 8, 12, 16, 20. */
  grantsAbilityIncrease: boolean;
  /** Class skills (union of all classes taken + this one + race). */
  classSkills: SkillKey[];
}

export interface LevelUpSelection {
  className: string;
  hitPointRoll: number;
  skillRanks: Partial<Record<SkillKey, number>>;
  feats?: string[];
  abilityIncrease?: AbilityKey;
}

function effectiveAbilityMod(build: CharacterBuild, ability: AbilityKey): number {
  const score = effectiveBaseScores(build)[ability] +
    sumRacialAbility(build.race.abilityModifiers, ability);
  return abilityModifier(score);
}

/** Compute the choices the next level in `className` offers. Pure. */
export function planLevelUp(
  build: CharacterBuild,
  className: string,
  registry: ClassRegistry = SAMPLE_CLASSES,
): LevelUpPlan {
  const def = getClassDefinition(registry, className);
  if (!def) throw new Error(`Unknown class "${className}"`);

  const characterLevel = build.levels.length + 1;
  const skillPoints = Math.max(1, def.skillRanksPerLevel + effectiveAbilityMod(build, "int"));

  const classSkillSet = new Set<SkillKey>(build.race.classSkills ?? []);
  for (const existing of classLevelCounts(build).keys()) {
    const d = getClassDefinition(registry, existing);
    if (d) for (const s of d.classSkills) classSkillSet.add(s);
  }
  for (const s of def.classSkills) classSkillSet.add(s);

  return {
    characterLevel,
    className: def.name,
    hitDie: def.hitDie,
    averageHitPoints: Math.floor(def.hitDie / 2) + 1,
    skillPoints,
    maxRanksPerSkill: characterLevel,
    grantsFeat: characterLevel % 2 === 1,
    grantsAbilityIncrease: characterLevel % 4 === 0,
    classSkills: [...classSkillSet],
  };
}

/** Validate a player's level-up choices against the plan. */
export function validateLevelUpSelection(
  plan: LevelUpPlan,
  selection: LevelUpSelection,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ranks = Object.values(selection.skillRanks).reduce<number>((s, n) => s + (n ?? 0), 0);

  if (ranks > plan.skillPoints) {
    issues.push({
      severity: "error",
      code: "skill-points-over-budget",
      message: `Allocated ${ranks} skill ranks but only ${plan.skillPoints} available.`,
    });
  }
  for (const [key, n] of Object.entries(selection.skillRanks) as [SkillKey, number][]) {
    if ((n ?? 0) > 1) {
      issues.push({
        severity: "error",
        code: "skill-ranks-per-level",
        message: `Skill "${key}": at most 1 rank may be added per level.`,
      });
    }
  }
  if (selection.abilityIncrease && !plan.grantsAbilityIncrease) {
    issues.push({
      severity: "error",
      code: "illegal-ability-increase",
      message: `Level ${plan.characterLevel} does not grant an ability score increase.`,
    });
  }
  if (plan.grantsAbilityIncrease && !selection.abilityIncrease) {
    issues.push({
      severity: "warning",
      code: "ability-increase-unspent",
      message: `Level ${plan.characterLevel} grants a +1 ability score increase you have not assigned.`,
    });
  }
  if (plan.grantsFeat && (selection.feats ?? []).length === 0) {
    issues.push({
      severity: "warning",
      code: "feat-unspent",
      message: `Level ${plan.characterLevel} grants a feat you have not chosen.`,
    });
  }
  return issues;
}

/** Apply a level-up selection, returning a NEW build. */
export function applyLevelUp(
  build: CharacterBuild,
  selection: LevelUpSelection,
): CharacterBuild {
  return levelUp(build, {
    className: selection.className,
    hitPointRoll: selection.hitPointRoll,
    skillRanks: selection.skillRanks,
    feats: selection.feats,
    abilityIncrease: selection.abilityIncrease,
  });
}

function sumRacialAbility(mods: Modifier[] | undefined, ability: AbilityKey): number {
  if (!mods) return 0;
  return mods
    .filter((m) => m.target === ability)
    .reduce((sum, m) => sum + m.value, 0);
}
