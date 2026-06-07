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
export { renderSheet, explainStat } from "./format";
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
