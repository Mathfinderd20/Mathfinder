import { modifiersFor, resolveModifiers } from "./modifiers";
import type {
  BreakdownEntry,
  DerivedStat,
  DerivedWeapon,
  Modifier,
  Weapon,
  WeaponHandedness,
} from "./types";

/** Strength-to-damage multiplier by handedness. */
function strDamageFactor(handedness: WeaponHandedness | undefined): number {
  switch (handedness) {
    case "two":
      return 1.5;
    case "off":
      return 0.5;
    default:
      return 1;
  }
}

function critDisplay(weapon: Weapon): string {
  const range = weapon.critRange ?? 20;
  const mult = weapon.critMultiplier ?? 2;
  const rangeStr = range >= 20 ? "20" : `${range}-20`;
  return `${rangeStr}/x${mult}`;
}

/**
 * Derive attack + damage lines for each equipped weapon.
 *
 * Attack reuses the already-computed melee/ranged attack totals (so Weapon
 * Focus, Power Attack penalties, size, etc. are all included). Damage =
 * weapon dice + ability-to-damage (scaled by handedness) + damage modifiers.
 */
export function deriveWeapons(args: {
  weapons: Weapon[] | undefined;
  strMod: number;
  meleeAttack: DerivedStat;
  rangedAttack: DerivedStat;
  modifiers: Modifier[];
}): DerivedWeapon[] {
  const { weapons, strMod, meleeAttack, rangedAttack, modifiers } = args;
  if (!weapons || weapons.length === 0) return [];

  return weapons.map((weapon) => {
    const isMelee = weapon.category === "melee";
    const attack = isMelee ? meleeAttack : rangedAttack;

    const breakdown: BreakdownEntry[] = [];

    // Ability-to-damage: Str for melee by default; ranged adds nothing unless set.
    const abilityToDamage =
      weapon.damageAbility === undefined ? (isMelee ? strMod : null) : null;
    if (abilityToDamage !== null && abilityToDamage !== 0) {
      const factor = strDamageFactor(weapon.handedness);
      const value = Math.floor(abilityToDamage * factor);
      if (value !== 0) {
        const label = factor === 1 ? "Strength" : `Strength x${factor}`;
        breakdown.push({ source: label, type: "ability", value });
      }
    }

    const damageTarget = isMelee ? "damage.melee" : "damage.ranged";
    for (const m of resolveModifiers(modifiersFor(modifiers, damageTarget)).contributing) {
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }

    const damageBonus = breakdown.reduce((sum, b) => sum + b.value, 0);
    const bonusStr = damageBonus === 0 ? "" : damageBonus > 0 ? `+${damageBonus}` : `${damageBonus}`;

    return {
      name: weapon.name,
      category: weapon.category,
      attack,
      damageDice: weapon.damageDice,
      damageBonus,
      damageDisplay: `${weapon.damageDice}${bonusStr}`,
      damageBreakdown: breakdown,
      crit: critDisplay(weapon),
    };
  });
}
