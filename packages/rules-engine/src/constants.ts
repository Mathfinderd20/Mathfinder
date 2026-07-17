import type { BonusType, ModifierTarget, Size } from "./types";

/** Size modifier to AC and attack rolls. */
export const SIZE_AC_ATTACK_MOD: Record<Size, number> = {
  fine: 8,
  diminutive: 4,
  tiny: 2,
  small: 1,
  medium: 0,
  large: -1,
  huge: -2,
  gargantuan: -4,
  colossal: -8,
};

/** Special size modifier to CMB and CMD (inverse direction of the AC/attack mod). */
export const SIZE_CMB_CMD_MOD: Record<Size, number> = {
  fine: -8,
  diminutive: -4,
  tiny: -2,
  small: -1,
  medium: 0,
  large: 1,
  huge: 2,
  gargantuan: 4,
  colossal: 8,
};

/**
 * Bonus types that STACK with themselves. Everything else: same type does not
 * stack, take the highest. (Penalties always stack regardless of type.)
 */
export const STACKING_BONUS_TYPES: ReadonlySet<BonusType> = new Set<BonusType>([
  "untyped",
  "dodge",
  "circumstance",
]);

/** AC bonus types EXCLUDED when computing touch AC. */
export const TOUCH_EXCLUDED_AC_TYPES: ReadonlySet<BonusType> =
  new Set<BonusType>(["armor", "shield", "natural-armor"]);

/** AC bonus types EXCLUDED when computing flat-footed AC. */
export const FLAT_FOOTED_EXCLUDED_AC_TYPES: ReadonlySet<BonusType> =
  new Set<BonusType>(["dodge"]);

/**
 * AC bonus types that ALSO apply to CMD. (Armor, shield, and natural armor do
 * not improve CMD; dodge/deflection/etc. do.)
 */
export const CMD_RELEVANT_AC_TYPES: ReadonlySet<BonusType> = new Set<BonusType>(
  [
    "deflection",
    "dodge",
    "circumstance",
    "insight",
    "luck",
    "morale",
    "profane",
    "sacred",
  ],
);

/**
 * Group-target expansion. A modifier on a group target counts toward each
 * member when that member's stat is resolved.
 */
export const TARGET_ALIASES: Record<string, ModifierTarget[]> = {
  "save.fort": ["save.fort", "save.all"],
  "save.ref": ["save.ref", "save.all"],
  "save.will": ["save.will", "save.all"],
  "attack.melee": ["attack.melee", "attack"],
  "attack.ranged": ["attack.ranged", "attack"],
  "damage.melee": ["damage.melee", "damage"],
  "damage.ranged": ["damage.ranged", "damage"],
};
