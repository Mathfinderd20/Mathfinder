import {
  SAMPLE_CLASSES,
  spellsByLevel,
  type ClassDefinition,
  type ClassRegistry,
} from "@mathfinder/rules-engine";

const SAMPLE_CLASS_ARRAY: ClassDefinition[] = Object.values(SAMPLE_CLASSES);

function normalizeClassName(name: string) {
  return name.toLowerCase();
}

function overridePacklessClasses(
  classes: ClassDefinition[],
): ClassDefinition[] {
  const byName = Object.fromEntries(
    classes.map((item) => [normalizeClassName(item.name), item]),
  ) as ClassRegistry;
  return Object.values(byName);
}

export const CORE_CLASSES: ClassDefinition[] = overridePacklessClasses([
  ...SAMPLE_CLASS_ARRAY,
  {
    name: "Paladin",
    alignmentRestriction: {
      type: "exact",
      alignment: "lawful-good",
      description: "Paladins must be lawful good.",
    },
    hitDie: 10,
    bab: "full",
    goodSaves: ["fort", "will"],
    skillRanksPerLevel: 2,
    classSkills: [
      "craft",
      "diplomacy",
      "handle-animal",
      "heal",
      "knowledge.nobility",
      "knowledge.religion",
      "profession",
      "ride",
      "sense-motive",
      "spellcraft",
    ],
    spellcasting: {
      castingType: "prepared",
      castingAbility: "cha",
      spellsPerDay: {
        4: spellsByLevel(0, 0, 0, 1),
        5: spellsByLevel(0, 0, 0, 1),
      },
    },
  },
]);
