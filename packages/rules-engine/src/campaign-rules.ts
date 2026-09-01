import type { Weapon, WeaponProficiencyGroup } from "./types";

export type FirearmRulesMode =
  "standard" | "commonplace-guns" | "guns-everywhere";

export interface CampaignRules {
  firearmRules?: FirearmRulesMode;
  ignoreAlignmentRestrictions?: boolean;
  ignoreEncumbrance?: boolean;
}

export function alignmentRestrictionsEnabled(
  rules?: CampaignRules | null,
): boolean {
  return rules?.ignoreAlignmentRestrictions !== true;
}

export function encumbranceRulesEnabled(rules?: CampaignRules | null): boolean {
  return rules?.ignoreEncumbrance !== true;
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

export function firearmCostMultiplier(
  rules?: CampaignRules | null,
  weaponTechnology?: Weapon["weaponTechnology"],
) {
  const mode = firearmRulesMode(rules);
  if (mode === "guns-everywhere") return 0.1;
  // An omitted technology intentionally follows early-firearm pricing so
  // callers can apply Commonplace Guns to firearm ammunition as one catalog.
  if (mode === "commonplace-guns" && weaponTechnology !== "advanced") {
    return 0.25;
  }
  return 1;
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
  if (!weaponUsesFirearmRules(weapon)) return weapon.proficiencyGroup;
  const mode = firearmRulesMode(rules);
  if (mode === "guns-everywhere") return "simple";
  if (mode === "commonplace-guns") return "martial";
  return weapon.proficiencyGroup;
}

export function applyCampaignRulesToWeapon<
  T extends Pick<
    Weapon,
    "proficiencyGroup" | "specialTags" | "firearmCategory" | "weaponTechnology"
  > & { costGp?: number },
>(weapon: T, rules?: CampaignRules | null): T {
  if (!weaponUsesFirearmRules(weapon)) return weapon;
  return {
    ...weapon,
    proficiencyGroup: effectiveWeaponProficiencyGroup(weapon, rules),
    costGp:
      typeof weapon.costGp === "number"
        ? Math.round(
            weapon.costGp *
              firearmCostMultiplier(rules, weapon.weaponTechnology) *
              100,
          ) / 100
        : weapon.costGp,
  };
}
