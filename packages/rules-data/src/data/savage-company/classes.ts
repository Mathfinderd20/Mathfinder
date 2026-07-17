import type { ClassDefinition } from "@mathfinder/rules-engine";

const INFANTRYMAN_FIREARM_PROFICIENCIES = [
  "Pistol",
  "Musket",
  "Blunderbuss",
] as const;

export const SAVAGE_COMPANY_CLASSES: ClassDefinition[] = [
  {
    name: "Infantryman",
    hitDie: 10,
    bab: "full",
    goodSaves: ["fort", "ref"],
    skillRanksPerLevel: 4,
    armorProficiencies: ["light", "medium"],
    weaponProficiencies: ["simple", "martial"],
    classSkills: [
      "acrobatics",
      "climb",
      "craft",
      "heal",
      "intimidate",
      "knowledge.engineering",
      "perception",
      "profession",
      "ride",
      "sleight-of-hand",
      "survival",
      "swim",
    ],
    specificWeaponProficiencies: [...INFANTRYMAN_FIREARM_PROFICIENCIES],
  },
];
