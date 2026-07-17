import {
  buildCompendiumIndex,
  getCompendiumEntryById,
  getCompendiumEntryByName,
} from "../compendium";
import type { Weapon } from "../types";

export interface WeaponDefinition extends Weapon {
  id: string;
  weightLb: number;
  costGp: number;
}

export interface EquipmentWeaponTemplate {
  name: string;
  weight: number;
  costGp: number;
  weapon: Omit<Weapon, "name" | "proficient">;
}

export const CORE_WEAPONS: WeaponDefinition[] = [
  {
    id: "club",
    name: "Club",
    category: "melee",
    proficiencyGroup: "simple",
    damageDice: "1d6",
    handedness: "one",
    damageTypes: ["bludgeoning"],
    specialTags: ["thrown"],
    rangeIncrementFeet: 10,
    weightLb: 3,
    costGp: 0,
  },
  {
    id: "dagger",
    name: "Dagger",
    category: "melee",
    proficiencyGroup: "simple",
    damageDice: "1d4",
    handedness: "light",
    critRange: 19,
    damageTypes: ["piercing", "slashing"],
    specialTags: ["thrown"],
    rangeIncrementFeet: 10,
    weightLb: 1,
    costGp: 2,
  },
  {
    id: "quarterstaff",
    name: "Quarterstaff",
    category: "melee",
    proficiencyGroup: "simple",
    damageDice: "1d6",
    handedness: "two",
    damageTypes: ["bludgeoning"],
    specialTags: ["double"],
    weightLb: 4,
    costGp: 0,
  },
  {
    id: "javelin",
    name: "Javelin",
    category: "ranged",
    proficiencyGroup: "simple",
    damageDice: "1d6",
    damageTypes: ["piercing"],
    rangeIncrementFeet: 30,
    specialTags: ["thrown"],
    weightLb: 2,
    costGp: 1,
  },
  {
    id: "heavy-crossbow",
    name: "Heavy Crossbow",
    category: "ranged",
    proficiencyGroup: "simple",
    damageDice: "1d10",
    critRange: 19,
    damageTypes: ["piercing"],
    rangeIncrementFeet: 120,
    specialTags: ["reload"],
    ammoType: "bolt",
    ammoPerAttack: 1,
    reloadType: "move",
    weightLb: 8,
    costGp: 50,
  },
  {
    id: "pistol",
    name: "Pistol",
    category: "ranged",
    proficiencyGroup: "exotic",
    damageDice: "1d8",
    critMultiplier: 4,
    damageTypes: ["piercing"],
    rangeIncrementFeet: 20,
    specialTags: ["firearm", "reload"],
    ammoType: "bullet",
    ammoPerAttack: 1,
    reloadType: "move",
    firearmCategory: "one-handed",
    weaponTechnology: "early",
    misfire: 1,
    targetsTouchAcWithinFirstRangeIncrement: true,
    weightLb: 4,
    costGp: 1000,
  },
  {
    id: "musket",
    name: "Musket",
    category: "ranged",
    proficiencyGroup: "exotic",
    damageDice: "1d12",
    critMultiplier: 4,
    damageTypes: ["piercing"],
    rangeIncrementFeet: 40,
    specialTags: ["firearm", "reload", "two-handed"],
    ammoType: "bullet",
    ammoPerAttack: 1,
    reloadType: "full-round",
    firearmCategory: "two-handed",
    weaponTechnology: "early",
    misfire: 1,
    targetsTouchAcWithinFirstRangeIncrement: true,
    weightLb: 9,
    costGp: 1500,
  },
  {
    id: "blunderbuss",
    name: "Blunderbuss",
    category: "ranged",
    proficiencyGroup: "exotic",
    damageDice: "1d8",
    critMultiplier: 2,
    damageTypes: ["piercing"],
    rangeIncrementFeet: 15,
    specialTags: ["firearm", "reload", "scatter", "two-handed"],
    ammoType: "bullet",
    ammoPerAttack: 1,
    reloadType: "move",
    firearmCategory: "scatter",
    weaponTechnology: "early",
    misfire: 2,
    targetsTouchAcWithinFirstRangeIncrement: true,
    weightLb: 8,
    costGp: 1200,
  },
  {
    id: "greataxe",
    name: "Greataxe",
    category: "melee",
    proficiencyGroup: "martial",
    damageDice: "1d12",
    handedness: "two",
    critMultiplier: 3,
    damageTypes: ["slashing"],
    weightLb: 12,
    costGp: 20,
  },
  {
    id: "longsword",
    name: "Longsword",
    category: "melee",
    proficiencyGroup: "martial",
    damageDice: "1d8",
    handedness: "one",
    critRange: 19,
    damageTypes: ["slashing"],
    weightLb: 4,
    costGp: 15,
  },
  {
    id: "rapier",
    name: "Rapier",
    category: "melee",
    proficiencyGroup: "martial",
    damageDice: "1d6",
    handedness: "one",
    critRange: 18,
    damageTypes: ["piercing"],
    specialTags: ["finesse"],
    weightLb: 2,
    costGp: 20,
  },
  {
    id: "shortbow",
    name: "Shortbow",
    category: "ranged",
    proficiencyGroup: "martial",
    damageDice: "1d6",
    critMultiplier: 3,
    damageTypes: ["piercing"],
    rangeIncrementFeet: 60,
    ammoType: "arrow",
    ammoPerAttack: 1,
    reloadType: "free",
    weightLb: 2,
    costGp: 30,
  },
  {
    id: "longbow",
    name: "Longbow",
    category: "ranged",
    proficiencyGroup: "martial",
    damageDice: "1d8",
    critMultiplier: 3,
    damageTypes: ["piercing"],
    rangeIncrementFeet: 100,
    specialTags: ["two-handed"],
    ammoType: "arrow",
    ammoPerAttack: 1,
    reloadType: "free",
    weightLb: 3,
    costGp: 75,
  },
];

export const WEAPONS: WeaponDefinition[] = [...CORE_WEAPONS];

const WEAPON_INDEX = buildCompendiumIndex(WEAPONS);

export const WEAPONS_BY_ID: Record<string, WeaponDefinition> =
  WEAPON_INDEX.byId;

export const WEAPONS_BY_NAME: Record<string, WeaponDefinition> =
  WEAPON_INDEX.byName;

export function getWeapon(id: string): WeaponDefinition | undefined {
  return getCompendiumEntryById(WEAPON_INDEX, id);
}

export function getWeaponByName(name: string): WeaponDefinition | undefined {
  return getCompendiumEntryByName(WEAPON_INDEX, name);
}

export function equipmentWeaponTemplate(
  weapon: WeaponDefinition,
): EquipmentWeaponTemplate {
  return {
    name: weapon.name,
    weight: weapon.weightLb,
    costGp: weapon.costGp,
    weapon: {
      weaponTemplateId: weapon.id,
      category: weapon.category,
      proficiencyGroup: weapon.proficiencyGroup,
      damageDice: weapon.damageDice,
      handedness: weapon.handedness,
      critRange: weapon.critRange,
      critMultiplier: weapon.critMultiplier,
      rangeIncrementFeet: weapon.rangeIncrementFeet,
      damageTypes: weapon.damageTypes,
      specialTags: weapon.specialTags,
      ammoType: weapon.ammoType,
      loadedAmmoType: weapon.loadedAmmoType,
      ammoPerAttack: weapon.ammoPerAttack,
      reloadType: weapon.reloadType,
      firearmCategory: weapon.firearmCategory,
      weaponTechnology: weapon.weaponTechnology,
      attackModifier: weapon.attackModifier,
      extraDamageDice: weapon.extraDamageDice,
      ammoNotes: weapon.ammoNotes,
      ordnanceProfile: weapon.ordnanceProfile,
      misfire: weapon.misfire,
      targetsTouchAcWithinFirstRangeIncrement:
        weapon.targetsTouchAcWithinFirstRangeIncrement,
      damageAbility: weapon.damageAbility,
    },
  };
}
