import type { DerivedSheet } from "./types";
import {
  resourcePoolCalculation,
  type DerivedResourcePool,
  type ResourcePoolDefinition,
} from "./content/activatables";

/** Explicit core formulas, not guessed from prose. Class levels are independent
 * for multiclass characters. Unknown content retains its supplied rules text. */
export function referenceAbilityMechanics(
  name: string,
  className: string | undefined,
  sheet: DerivedSheet,
): { details: string[]; pool?: DerivedResourcePool } {
  const levels = Object.fromEntries(
    sheet.descriptor.classes.map((entry) => [
      entry.name.toLowerCase(),
      entry.level,
    ]),
  );
  const feats = sheet.descriptor.feats.map((entry) => entry.name.toLowerCase());
  const modifiers = Object.fromEntries(
    Object.entries(sheet.abilities).map(([key, ability]) => [key, ability.mod]),
  );
  const featCount = (feat: string) =>
    feats.filter((entry) => entry === feat).length;
  let definition: ResourcePoolDefinition | undefined;
  let bonus = 0;
  let bonusName = "";
  let details: string[] = [];
  const cls = className?.toLowerCase();
  if (name === "Channel Energy" && cls === "cleric" && levels.cleric) {
    const level = levels.cleric;
    details = [
      `${Math.ceil(level / 2)}d6`,
      `Will DC ${10 + Math.floor(level / 2) + (modifiers.cha ?? 0) + (featCount("improved channel") ? 2 : 0)}`,
    ];
    definition = {
      id: "cleric-channel-energy",
      name,
      unit: "uses/day",
      description:
        "Channel energy; Will halves damage. Healing and targets are resolved at the table.",
      maximum: { base: 3, ability: "cha", minimum: 0 },
    };
    bonus = featCount("extra channel") * 2;
    bonusName = "Extra Channel";
  } else if (
    name === "Lay on Hands" &&
    cls === "paladin" &&
    (levels.paladin ?? 0) >= 2
  ) {
    details = [`${Math.floor(levels.paladin! / 2)}d6`];
    definition = {
      id: "paladin-lay-on-hands",
      name,
      unit: "uses/day",
      description: "Lay on Hands daily uses.",
      maximum: {
        className: "paladin",
        classLevelMultiplier: 0.5,
        ability: "cha",
        minimum: 0,
      },
    };
    bonus = featCount("extra lay on hands") * 2;
    bonusName = "Extra Lay on Hands";
  } else if (
    name === "Stunning Fist" &&
    (!cls || cls === "monk" || cls === "monk (unchained)")
  ) {
    const monk = (levels.monk ?? 0) + (levels["monk (unchained)"] ?? 0);
    details = [
      `Fort DC ${10 + Math.floor(sheet.level / 2) + (modifiers.wis ?? 0)}`,
    ];
    definition = {
      id: "stunning-fist",
      name,
      unit: "uses/day",
      description:
        "Declare before an attack; an unsuccessful attack still consumes a use.",
      maximum: {
        base: monk + Math.floor((sheet.level - monk) / 4),
        minimum: 0,
      },
    };
  } else if (
    name === "Sneak Attack" &&
    (cls === "rogue" || cls === "rogue (unchained)") &&
    levels[cls]
  ) {
    details = [`${Math.ceil(levels[cls]! / 2)}d6`];
  }
  if (!definition) return { details };
  const calculation = resourcePoolCalculation(
    definition,
    {
      characterLevel: sheet.level,
      baseAttackBonus: sheet.baseAttackBonus,
      classLevels: levels,
      abilityModifiers: Object.fromEntries(
        Object.entries(sheet.abilities).map(([key, ability]) => [
          key,
          ability.mod,
        ]),
      ) as Record<keyof DerivedSheet["abilities"], number>,
    },
    bonus ? [{ label: bonusName, value: bonus }] : [],
  );
  return {
    details,
    pool: { ...definition, max: calculation.total, calculation },
  };
}
