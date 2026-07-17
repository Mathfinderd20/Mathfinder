import type { Modifier, SkillKey } from "../types";
import type { ClassDefinition } from "./classes";

export interface ArchetypeFeatureLike {
  level?: number;
  name: string;
  summary: string;
}

export interface ArchetypeDefinitionLike {
  id: string;
  name: string;
  pack?: string;
  baseClassName: string;
  description: string;
  replaces?: string[];
  alters?: string[];
  modifies?: string[];
  features?: ArchetypeFeatureLike[];
  notes?: string[];
}

export type ArchetypeRegistry = Record<string, ArchetypeDefinitionLike>;

export interface ArchetypePassiveContext {
  classLevel: number;
  wisdomMod: number;
}

interface ArchetypeModifierGrant {
  targets: string[];
  type: Modifier["type"];
  source: string;
  minClassLevel?: number;
  value?: number;
  valueScale?: "half-class-level" | "half-wisdom-mod" | "weapon-training-lite";
}

interface ArchetypeMechanicalRule {
  addClassSkills?: SkillKey[];
  usableUntrainedSkills?: SkillKey[];
  armorProficiencies?: NonNullable<ClassDefinition["armorProficiencies"]>;
  shieldProficiencies?: NonNullable<ClassDefinition["shieldProficiencies"]>;
  weaponProficiencies?: NonNullable<ClassDefinition["weaponProficiencies"]>;
  specificWeaponProficiencies?: NonNullable<
    ClassDefinition["specificWeaponProficiencies"]
  >;
  removeSpellcasting?: boolean;
  disablesDomains?: boolean;
  grantedFeatsByLevel?: Partial<Record<number, string[]>>;
  modifierGrants?: ArchetypeModifierGrant[];
  passiveModifiers?: (context: ArchetypePassiveContext) => Modifier[];
}

const KNOWLEDGE_SKILLS: SkillKey[] = [
  "knowledge.arcana",
  "knowledge.dungeoneering",
  "knowledge.engineering",
  "knowledge.geography",
  "knowledge.history",
  "knowledge.local",
  "knowledge.nature",
  "knowledge.nobility",
  "knowledge.planes",
  "knowledge.religion",
];

export const ARCHETYPE_RULES: Record<string, ArchetypeMechanicalRule> = {
  "combat-medic": {
    armorProficiencies: ["light", "medium"],
    weaponProficiencies: ["simple", "martial"],
    grantedFeatsByLevel: { 2: ["Endurance", "Diehard"] },
  },
  bugler: {
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: [],
    weaponProficiencies: ["simple", "martial"],
  },
  "battle-chaplain": {
    armorProficiencies: ["light", "medium", "heavy"],
    shieldProficiencies: ["shield", "tower-shield"],
    weaponProficiencies: ["simple", "martial"],
    disablesDomains: true,
    modifierGrants: [
      {
        targets: ["attack", "damage"],
        type: "untyped",
        source: "Weapon Training",
        minClassLevel: 5,
        valueScale: "weapon-training-lite",
      },
      {
        targets: ["attack", "damage"],
        type: "sacred",
        source: "Battle Grace",
        minClassLevel: 10,
        valueScale: "half-wisdom-mod",
      },
    ],
  },
  sophic: {
    addClassSkills: ["knowledge.arcana"],
  },
  "steel-saint": {
    armorProficiencies: ["light", "medium", "heavy"],
    shieldProficiencies: [],
    weaponProficiencies: ["simple"],
  },
  "roughneck-ranger": {
    addClassSkills: ["disable-device", "craft"],
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: [],
    weaponProficiencies: ["simple", "martial"],
    removeSpellcasting: true,
    modifierGrants: [
      {
        targets: ["skill.craft"],
        type: "untyped",
        source: "Alchemical Aptitude",
        valueScale: "half-class-level",
      },
    ],
  },
  "phantom-warrior": {
    armorProficiencies: ["light", "medium"],
    shieldProficiencies: ["shield"],
    weaponProficiencies: ["simple", "martial"],
    removeSpellcasting: true,
    modifierGrants: [
      {
        targets: ["attack", "damage"],
        type: "untyped",
        source: "Weapon Training",
        minClassLevel: 5,
        valueScale: "weapon-training-lite",
      },
    ],
  },
  craftwright: {
    grantedFeatsByLevel: { 3: ["Master Craftsman"], 5: ["Craft Construct"] },
  },
  retribution: {
    grantedFeatsByLevel: {
      3: ["Siege Engineer"],
      9: ["Master Siege Engineer"],
    },
  },
  "skirmish-marauder": {
    modifierGrants: [
      {
        targets: ["attack", "damage"],
        type: "untyped",
        source: "Weapon Training",
        minClassLevel: 5,
        valueScale: "weapon-training-lite",
      },
    ],
  },
  "covert-infiltrator": {
    usableUntrainedSkills: KNOWLEDGE_SKILLS,
    grantedFeatsByLevel: { 5: ["Weapon Finesse"] },
    modifierGrants: [
      {
        targets: [
          ...KNOWLEDGE_SKILLS.map((skill) => `skill.${skill}`),
          "skill.linguistics",
        ],
        type: "untyped",
        source: "Intel",
        valueScale: "half-class-level",
      },
    ],
  },
  sharpscout: {
    specificWeaponProficiencies: ["Longbow"],
  },
};

function cloneSpellcasting(spellcasting: ClassDefinition["spellcasting"]) {
  if (!spellcasting) return undefined;
  const source = spellcasting as NonNullable<ClassDefinition["spellcasting"]>;
  return {
    ...source,
    spellsPerDay: Object.fromEntries(
      Object.entries(source.spellsPerDay).map(([level, slots]) => [
        level,
        { ...slots },
      ]),
    ) as NonNullable<ClassDefinition["spellcasting"]>["spellsPerDay"],
    spellsKnown: source.spellsKnown
      ? (Object.fromEntries(
          Object.entries(source.spellsKnown).map(([level, slots]) => [
            level,
            { ...slots },
          ]),
        ) as NonNullable<ClassDefinition["spellcasting"]>["spellsKnown"])
      : undefined,
  };
}

export function applyArchetypeClassOverrides(
  base: ClassDefinition,
  archetypes: ArchetypeDefinitionLike[],
): ClassDefinition {
  const next: ClassDefinition = {
    ...base,
    classSkills: [...base.classSkills],
    armorProficiencies: [...(base.armorProficiencies ?? [])],
    shieldProficiencies: [...(base.shieldProficiencies ?? [])],
    weaponProficiencies: [...(base.weaponProficiencies ?? [])],
    specificWeaponProficiencies: [...(base.specificWeaponProficiencies ?? [])],
    spellcasting: cloneSpellcasting(base.spellcasting),
  };
  const addSkill = (skill: SkillKey) => {
    if (!next.classSkills.includes(skill)) next.classSkills.push(skill);
  };
  for (const archetype of archetypes) {
    const rule = ARCHETYPE_RULES[archetype.id.toLowerCase()];
    if (!rule) continue;
    for (const skill of rule.addClassSkills ?? []) addSkill(skill);
    if (rule.armorProficiencies)
      next.armorProficiencies = [...rule.armorProficiencies];
    if (rule.shieldProficiencies)
      next.shieldProficiencies = [...rule.shieldProficiencies];
    if (rule.weaponProficiencies)
      next.weaponProficiencies = [...rule.weaponProficiencies];
    if (rule.specificWeaponProficiencies)
      next.specificWeaponProficiencies = [...rule.specificWeaponProficiencies];
    if (rule.removeSpellcasting) next.spellcasting = undefined;
  }
  return next;
}

export function archetypeDisablesDomains(
  archetypes: ArchetypeDefinitionLike[],
): boolean {
  return archetypes.some(
    (archetype) => ARCHETYPE_RULES[archetype.id.toLowerCase()]?.disablesDomains,
  );
}

export function archetypeGrantedFeatNames(
  archetype: ArchetypeDefinitionLike,
  classLevel: number,
): string[] {
  return [
    ...(ARCHETYPE_RULES[archetype.id.toLowerCase()]?.grantedFeatsByLevel?.[
      classLevel
    ] ?? []),
  ];
}

function modifierGrantValue(
  grant: ArchetypeModifierGrant,
  context: ArchetypePassiveContext,
): number {
  if (grant.valueScale === "half-class-level")
    return Math.floor(context.classLevel / 2);
  if (grant.valueScale === "half-wisdom-mod")
    return Math.max(0, Math.floor(context.wisdomMod / 2));
  if (grant.valueScale === "weapon-training-lite") {
    return context.classLevel >= 5
      ? 1 + Math.floor((context.classLevel - 5) / 4)
      : 0;
  }
  return grant.value ?? 0;
}

function resolveModifierGrants(
  grants: ArchetypeModifierGrant[] | undefined,
  context: ArchetypePassiveContext,
): Modifier[] {
  if (!grants?.length) return [];
  const modifiers: Modifier[] = [];
  for (const grant of grants) {
    if ((grant.minClassLevel ?? 1) > context.classLevel) continue;
    const value = modifierGrantValue(grant, context);
    if (value === 0) continue;
    for (const target of grant.targets) {
      modifiers.push({ target, type: grant.type, value, source: grant.source });
    }
  }
  return modifiers;
}

export function archetypePassiveModifiers(
  context: ArchetypePassiveContext,
  archetypes: ArchetypeDefinitionLike[],
): Modifier[] {
  return archetypes.flatMap((archetype) => {
    const rule = ARCHETYPE_RULES[archetype.id.toLowerCase()];
    return [
      ...resolveModifierGrants(rule?.modifierGrants, context),
      ...(rule?.passiveModifiers?.(context) ?? []),
    ];
  });
}

export function archetypeSkillUsableOverrides(
  archetypes: ArchetypeDefinitionLike[],
): Partial<Record<SkillKey, boolean>> {
  const overrides: Partial<Record<SkillKey, boolean>> = {};
  for (const archetype of archetypes) {
    const rule = ARCHETYPE_RULES[archetype.id.toLowerCase()];
    for (const skill of rule?.usableUntrainedSkills ?? [])
      overrides[skill] = true;
  }
  return overrides;
}
