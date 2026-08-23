import type { Weapon, WeaponProficiencyGroup } from "./types";

export type FirearmRulesMode = "standard" | "guns-everywhere";

export interface CampaignRules {
  firearmRules?: FirearmRulesMode;
}

export function firearmRulesMode(
  rules?: CampaignRules | null,
): FirearmRulesMode {
  return rules?.firearmRules ?? "standard";
}

export function infantrymanGunTrainingPickCount(
  classLevel: number,
  rules?: CampaignRules | null,
) {
  const minimumLevel = firearmRulesMode(rules) === "guns-everywhere" ? 1 : 5;
  return classLevel >= minimumLevel ? 1 : 0;
}

export function firearmCostMultiplier(rules?: CampaignRules | null) {
  return firearmRulesMode(rules) === "guns-everywhere" ? 0.1 : 1;
}

export function weaponUsesFirearmRules(
  weapon: Pick<Weapon, "specialTags" | "firearmCategory">,
) {
  return (
    weapon.firearmCategory != null ||
    (weapon.specialTags ?? []).some((tag) => tag.toLowerCase() === "firearm")
  );
}

export function effectiveWeaponProficiencyGroup(
  weapon: Pick<Weapon, "proficiencyGroup" | "specialTags" | "firearmCategory">,
  rules?: CampaignRules | null,
): WeaponProficiencyGroup | undefined {
  if (
    firearmRulesMode(rules) === "guns-everywhere" &&
    weaponUsesFirearmRules(weapon)
  ) {
    return "simple";
  }
  return weapon.proficiencyGroup;
}

export function applyCampaignRulesToWeapon<
  T extends Pick<
    Weapon,
    "proficiencyGroup" | "specialTags" | "firearmCategory"
  > & { costGp?: number },
>(weapon: T, rules?: CampaignRules | null): T {
  if (!weaponUsesFirearmRules(weapon)) return weapon;
  return {
    ...weapon,
    proficiencyGroup: effectiveWeaponProficiencyGroup(weapon, rules),
    costGp:
      typeof weapon.costGp === "number"
        ? Math.round(weapon.costGp * firearmCostMultiplier(rules) * 100) / 100
        : weapon.costGp,
  };
}
