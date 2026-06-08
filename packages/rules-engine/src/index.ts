/**
 * @path-builder/rules-engine
 *
 * Pure, deterministic Pathfinder 1e rules engine. Runs identically on device
 * and server. Feats, gear, class features, conditions, auras, and group buffs
 * all funnel into one uniform Modifier stream consumed by `computeSheet`.
 */

export * from "./types";
export { computeSheet, abilityModifier } from "./compute";
export { deriveAbilities } from "./abilities";
export {
  deriveSkills,
  SKILL_DEFINITIONS,
  CLASS_SKILL_BONUS,
} from "./skills";
export { deriveHitPoints, deriveSpeed } from "./vitals";
export { deriveWeapons } from "./weapons";
export { deriveEncumbrance, loadThresholds, loadBand } from "./encumbrance";
export { deriveSpellcasting, spellSaveDc, bonusSpellSlots } from "./spellcasting";
export { renderSheet, explainStat } from "./format";

// ---- Content: activatables ----
export {
  collectActivatableEffects,
  resolveActivatableSelections,
  groupActivatables,
  activatableModifiers,
  activatableResourceMax,
  babStep,
  activatableFeaturesForDescriptor,
  activatableFeatsForDescriptor,
  type ActivatableEffect,
  type ActivatableResource,
  type ActivatableConflict,
  type ResolvedActivatables,
  type ActivationContext,
} from "./content/activatables";

// ---- Content: class features ----
export {
  CORE_CLASS_FEATURES,
  SAVAGE_COMPANY_CLASS_FEATURES,
  CLASS_FEATURES,
  buildClassFeatureRegistry,
  classFeaturesGrantedAt,
  classFeatureEffects,
  type ClassFeatureDefinition,
  type ClassFeatureRegistry,
} from "./content/class-features";

// ---- Content: feats ----
export {
  CORE_FEATS,
  SAVAGE_COMPANY_FEATS,
  FEATS,
  buildFeatRegistry,
  getFeat,
  listFeats,
  featEffects,
  checkPrerequisites,
  featContextFromSheet,
  type FeatDefinition,
  type FeatRegistry,
  type Prerequisite,
  type FeatContext,
  type PrereqResult,
} from "./content/feats";

// ---- Build / level-up layer ----
export {
  buildCharacter,
  levelUp,
  levelDown,
  classLevelCounts,
  validateBuild,
  planLevelUp,
  validateLevelUpSelection,
  applyLevelUp,
  type LevelUpPlan,
  type LevelUpSelection,
  type CharacterBuild,
  type RaceChoice,
  type LevelEntry,
  type EquipmentEntry,
  type ValidationIssue,
  type ValidationSeverity,
} from "./build/character";
export {
  SAMPLE_CLASSES,
  getClassDefinition,
  babForLevels,
  goodSaveBase,
  poorSaveBase,
  spellsByLevel,
  type ClassDefinition,
  type ClassRegistry,
  type SpellcastingProgression,
  type BabProgression,
  type SaveKind,
} from "./build/classes";
export {
  resolveModifiers,
  modifiersFor,
  type ResolvedModifiers,
} from "./modifiers";
export {
  SIZE_AC_ATTACK_MOD,
  SIZE_CMB_CMD_MOD,
  STACKING_BONUS_TYPES,
} from "./constants";
