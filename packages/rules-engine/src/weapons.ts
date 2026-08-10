import { ABILITY_LABEL } from "./abilities";
import { modifiersFor, resolveModifiers } from "./modifiers";
import type {
  AbilityKey,
  BreakdownEntry,
  DerivedStat,
  DerivedWeapon,
  Modifier,
  Weapon,
  WeaponAmmoAvailability,
  WeaponHandedness,
} from "./types";

/** Strength-to-damage multiplier by handedness. */
function strengthDamageFactor(
  strengthModifier: number,
  handedness: WeaponHandedness | undefined,
): number {
  // PF1 only multiplies a Strength bonus. A Strength penalty applies in full.
  if (strengthModifier < 0) return 1;
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

function weaponChoiceKey(weapon: Weapon): string {
  return weapon.name.trim().toLowerCase().replace(/\s+/g, " ");
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
  abilityMods: Record<AbilityKey, number>;
  meleeAttack: DerivedStat;
  rangedAttack: DerivedStat;
  modifiers: Modifier[];
  weaponDamageAbilityOverrides?: Partial<
    Record<string, "str" | "dex" | "con" | "int" | "wis" | "cha" | null>
  >;
  ammoAvailabilityByWeapon?: Partial<Record<string, WeaponAmmoAvailability[]>>;
}): DerivedWeapon[] {
  const {
    weapons,
    abilityMods,
    meleeAttack,
    rangedAttack,
    modifiers,
    weaponDamageAbilityOverrides,
    ammoAvailabilityByWeapon,
  } = args;
  if (!weapons || weapons.length === 0) return [];

  return weapons.map((weapon) => {
    const isMelee = weapon.category === "melee";
    const baseAttack = isMelee ? meleeAttack : rangedAttack;
    const attackBreakdown = [...baseAttack.breakdown];
    for (const modifier of resolveModifiers(
      modifiersFor(modifiers, `weapon.attack.${weaponChoiceKey(weapon)}`),
    ).contributing) {
      attackBreakdown.push({
        source: modifier.source,
        type: modifier.type,
        value: modifier.value,
      });
    }
    if (weapon.proficient === false) {
      attackBreakdown.push({
        source: "Nonproficient",
        type: "untyped",
        value: -4,
      });
    }
    if ((weapon.attackModifier ?? 0) !== 0) {
      attackBreakdown.push({
        source: "Ammo / payload",
        type: "untyped",
        value: weapon.attackModifier ?? 0,
      });
    }
    const attack = {
      total: attackBreakdown.reduce((sum, entry) => sum + entry.value, 0),
      breakdown: attackBreakdown,
    };

    const breakdown: BreakdownEntry[] = [];

    // Ability-to-damage: Str for melee by default; ranged adds nothing unless set.
    const weaponOverrideKey =
      weapon.weaponTemplateId?.toLowerCase() ?? weapon.name.toLowerCase();
    const explicitDamageAbility =
      weaponDamageAbilityOverrides?.[weaponOverrideKey] ?? weapon.damageAbility;
    const damageAbility =
      explicitDamageAbility === undefined
        ? isMelee
          ? "str"
          : null
        : explicitDamageAbility;
    const abilityToDamage =
      damageAbility === null ? null : abilityMods[damageAbility];
    if (
      damageAbility !== null &&
      abilityToDamage !== null &&
      abilityToDamage !== 0
    ) {
      const factor =
        damageAbility === "str"
          ? strengthDamageFactor(abilityToDamage, weapon.handedness)
          : 1;
      const value = Math.floor(abilityToDamage * factor);
      if (value !== 0) {
        const label =
          factor === 1
            ? ABILITY_LABEL[damageAbility]
            : `${ABILITY_LABEL[damageAbility]} x${factor}`;
        breakdown.push({ source: label, type: "ability", value });
      }
    }

    const damageTarget = isMelee ? "damage.melee" : "damage.ranged";
    for (const m of resolveModifiers(modifiersFor(modifiers, damageTarget))
      .contributing) {
      breakdown.push({ source: m.source, type: m.type, value: m.value });
    }
    for (const modifier of resolveModifiers(
      modifiersFor(modifiers, `weapon.damage.${weaponChoiceKey(weapon)}`),
    ).contributing) {
      breakdown.push({
        source: modifier.source,
        type: modifier.type,
        value: modifier.value,
      });
    }

    const damageBonus = breakdown.reduce((sum, b) => sum + b.value, 0);
    const bonusStr =
      damageBonus === 0
        ? ""
        : damageBonus > 0
          ? `+${damageBonus}`
          : `${damageBonus}`;

    const ammoAvailability =
      ammoAvailabilityByWeapon?.[
        `${weapon.weaponTemplateId?.toLowerCase() ?? weapon.name.toLowerCase()}::${weapon.sourceKind ?? "custom"}::${weapon.sourceIndex ?? -1}`
      ];
    const extraDamageDice = weapon.extraDamageDice?.filter(Boolean) ?? [];
    const extraDamageDisplay = extraDamageDice.length
      ? ` + ${extraDamageDice.join(" + ")}`
      : "";

    return {
      name: weapon.name,
      weaponTemplateId: weapon.weaponTemplateId,
      category: weapon.category,
      attack,
      damageDice: weapon.damageDice,
      damageBonus,
      damageDisplay: `${weapon.damageDice}${extraDamageDisplay}${bonusStr}`,
      damageBreakdown: breakdown,
      crit: critDisplay(weapon),
      rangeIncrementFeet: weapon.rangeIncrementFeet,
      damageTypes: weapon.damageTypes,
      specialTags: weapon.specialTags,
      ammoType: weapon.ammoType,
      loadedAmmoType: weapon.loadedAmmoType,
      ammoAvailable: ammoAvailability?.[0]?.available,
      ammoPerAttack: weapon.ammoPerAttack,
      ammoConsumptions: weapon.ammoConsumptions,
      ammoAvailability,
      reloadType: weapon.reloadType,
      firearmCategory: weapon.firearmCategory,
      weaponTechnology: weapon.weaponTechnology,
      attackModifier: weapon.attackModifier,
      extraDamageDice: weapon.extraDamageDice,
      ammoNotes: weapon.ammoNotes,
      ordnanceProfile: weapon.ordnanceProfile,
      sourceKind: weapon.sourceKind,
      sourceIndex: weapon.sourceIndex,
      misfire: weapon.misfire,
      targetsTouchAcWithinFirstRangeIncrement:
        weapon.targetsTouchAcWithinFirstRangeIncrement,
    };
  });
}
