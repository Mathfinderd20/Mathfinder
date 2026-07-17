/**
 * @path-builder/rules-engine
 *
 * Pure, deterministic Pathfinder 1e rules engine. Runs identically on device
 * and server. Feats, gear, class features, conditions, auras, and group buffs
 * all funnel into one uniform Modifier stream consumed by `computeSheet`.
 */

export * from "./types";
export { computeSheet, abilityModifier } from "./compute";
export {
  buildCompendiumIndex,
  getCompendiumEntryById,
  getCompendiumEntryByName,
  searchCompendiumEntries,
  type CompendiumEntry,
  type CompendiumIndex,
} from "./compendium";
export {
  appendCombatEvent,
  appendRuntimeEvent,
  createRuntimeStateSnapshot,
  makeCombatEvent,
  normalizeAmmoType,
  recordWeaponAttack,
  weaponTargetsDefense,
  reduceRuntimeState,
  resetLedger,
  resetWeaponAttackHistory,
  setWeaponAttackNote,
  setWeaponAttackOutcome,
  undoWeaponAttack,
  updateLedger,
  type AttackOutcome,
  type CombatEventRecord,
  type RuntimeAction,
  type RuntimeEventRecord,
  type RuntimeHistoryRecord,
  type RuntimeSpellCastCounts,
  type RuntimeStateSnapshot,
  type WeaponAttackHistory,
  type WeaponAttackRecord,
  type WeaponTargetDefense,
} from "./runtime";
export { deriveAbilities } from "./abilities";
export { deriveSkills, SKILL_DEFINITIONS, CLASS_SKILL_BONUS } from "./skills";
export { deriveHitPoints, deriveSpeed } from "./vitals";
export { deriveWeapons } from "./weapons";
export { deriveEncumbrance, loadThresholds, loadBand } from "./encumbrance";
export {
  deriveSpellcasting,
  spellSaveDc,
  bonusSpellSlots,
} from "./spellcasting";
export { renderSheet, explainStat } from "./format";
export {
  applyCampaignRulesToWeapon,
  effectiveWeaponProficiencyGroup,
  firearmCostMultiplier,
  firearmRulesMode,
  weaponUsesFirearmRules,
  type CampaignRules,
  type FirearmRulesMode,
} from "./campaign-rules";

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
  featQualifiesForGrant,
  checkPrerequisites,
  featContextFromSheet,
  type FeatDefinition,
  type FeatGrantKind,
  type FeatRegistry,
  type Prerequisite,
  type FeatContext,
  type PrereqResult,
} from "./content/feats";

// ---- Content: spells ----
export {
  CORE_SPELLS,
  SAVAGE_COMPANY_SPELLS,
  SPELLS,
  buildSpellRegistry,
  getSpell,
  classSpellLevel,
  type SpellDefinition,
  type SpellRegistry,
  type SpellClassLevel,
} from "./content/spells";
export {
  CLERIC_DOMAINS,
  DOMAINS,
  getDomain,
  grantedDomainSpells,
  domainExtraSlots,
  type DomainDefinition,
} from "./content/domains";
export {
  WIZARD_SCHOOLS,
  SCHOOLS,
  getSchool,
  grantedSchoolSpells,
  schoolExtraSlots,
  type SchoolDefinition,
} from "./content/schools";
export {
  SPELL_EFFECTS,
  SPELL_EFFECTS_BY_ID,
  SPELL_EFFECTS_BY_NAME,
  getSpellEffect,
  getSpellEffectByName,
  resolveSpellEffect,
  spellEffectCoverageSummary,
  spellEffectResourceLabel,
  spellEffectResourceMax,
  type ResolvedSpellEffect,
  type SpellEffectDefinition,
  type SpellEffectRuntimeContext,
  type SpellEffectTrackerDefinition,
} from "./content/spell-effects";
export {
  CORE_WEAPONS,
  WEAPONS,
  WEAPONS_BY_ID,
  WEAPONS_BY_NAME,
  getWeapon,
  getWeaponByName,
  equipmentWeaponTemplate,
  type WeaponDefinition,
  type EquipmentWeaponTemplate,
} from "./content/weapons";
export {
  CORE_MAGIC_ITEMS,
  MAGIC_ITEMS,
  MAGIC_ITEMS_BY_ID,
  getMagicItem,
  equipmentMagicItemTemplate,
  type MagicItemDefinition,
  type EquipmentMagicItemTemplate,
} from "./content/magic-items";
// ---- Build / level-up layer ----
export {
  buildCharacter,
  levelUp,
  levelDown,
  classLevelCounts,
  validateBuild,
  planLevelUp,
  createPreLevelBuild,
  validateLevelUpSelection,
  applyLevelUp,
  type LevelUpPlan,
  type LevelUpSelection,
  type PreLevelBuildSelection,
  type PreLevelBuildResult,
  type ArchetypeDefinitionLike,
  type ArchetypeRegistry,
  type CharacterBuild,
  type RaceChoice,
  type RaceChoiceSelection,
  type LevelEntry,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_CAPACITY,
  type EquipmentSlot,
  type FeatGrantSlot,
  type EquipmentEntry,
  type ValidationIssue,
  type ValidationSeverity,
} from "./build/character";
export {
  ARCHETYPE_RULES,
  applyArchetypeClassOverrides,
  archetypeDisablesDomains,
  archetypeGrantedFeatNames,
  archetypePassiveModifiers,
  archetypeSkillUsableOverrides,
  type ArchetypePassiveContext,
} from "./build/archetype-rules";
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
