import { buildCompendiumIndex, getCompendiumEntryByName } from "../compendium";
import type { AbilityKey, DerivedSheet, Modifier } from "../types";
import { babStep, type ActivatableEffect } from "./activatables";

/** A single feat prerequisite, with a human-readable label for the UI. */
export interface Prerequisite {
  type: "bab" | "ability" | "feat" | "character-level";
  ability?: AbilityKey;
  min?: number;
  featName?: string;
  /** e.g. "Str 13", "BAB +1", "Power Attack". */
  description: string;
}

export interface FeatDefinition {
  id: string;
  name: string;
  /** Content provenance: "core", "apg", "savage-company", ... */
  pack: string;
  description: string;
  prerequisites: Prerequisite[];
  /** Grant/source metadata like combat/item-creation/general. */
  tags?: string[];
  /** Passive effects granted, as modifiers. Empty for purely-activated feats. */
  effects: Modifier[];
  /** Optional activated state, e.g. Combat Expertise. */
  activatable?: ActivatableEffect;
}

export type FeatGrantKind = "general" | "fighter-bonus";

export type FeatRegistry = Record<string, FeatDefinition>;

/**
 * Core feats. Note: a few feats (e.g. Toughness, Weapon Focus) are simplified
 * to static effects for now; level-scaling and weapon specificity arrive with
 * the fuller content model.
 */
export const CORE_FEATS: FeatDefinition[] = [
  {
    id: "toughness",
    name: "Toughness",
    pack: "core",
    description: "You gain +3 hit points (or +1 per Hit Die if higher).",
    prerequisites: [],
    effects: [{ target: "hp", type: "untyped", value: 3, source: "Toughness" }],
  },
  {
    id: "improved-initiative",
    name: "Improved Initiative",
    pack: "core",
    description: "+4 bonus on initiative checks.",
    prerequisites: [],
    tags: ["combat"],
    effects: [
      {
        target: "init",
        type: "untyped",
        value: 4,
        source: "Improved Initiative",
      },
    ],
  },
  {
    id: "iron-will",
    name: "Iron Will",
    pack: "core",
    description: "+2 bonus on Will saves.",
    prerequisites: [],
    effects: [
      { target: "save.will", type: "untyped", value: 2, source: "Iron Will" },
    ],
  },
  {
    id: "improved-unarmed-strike",
    name: "Improved Unarmed Strike",
    pack: "core",
    description:
      "You are considered armed even when unarmed and do not provoke attacks of opportunity when making unarmed strikes.",
    prerequisites: [],
    tags: ["combat"],
    effects: [],
  },
  {
    id: "great-fortitude",
    name: "Great Fortitude",
    pack: "core",
    description: "+2 bonus on Fortitude saves.",
    prerequisites: [],
    effects: [
      {
        target: "save.fort",
        type: "untyped",
        value: 2,
        source: "Great Fortitude",
      },
    ],
  },
  {
    id: "lightning-reflexes",
    name: "Lightning Reflexes",
    pack: "core",
    description: "+2 bonus on Reflex saves.",
    prerequisites: [],
    effects: [
      {
        target: "save.ref",
        type: "untyped",
        value: 2,
        source: "Lightning Reflexes",
      },
    ],
  },
  {
    id: "dodge",
    name: "Dodge",
    pack: "core",
    description: "+1 dodge bonus to AC.",
    tags: ["combat"],
    prerequisites: [
      { type: "ability", ability: "dex", min: 13, description: "Dex 13" },
    ],
    effects: [{ target: "ac", type: "dodge", value: 1, source: "Dodge" }],
  },
  {
    id: "weapon-focus",
    name: "Weapon Focus",
    pack: "core",
    description:
      "+1 bonus on attack rolls with a chosen weapon (modeled as melee).",
    tags: ["combat"],
    prerequisites: [{ type: "bab", min: 1, description: "BAB +1" }],
    effects: [
      {
        target: "attack.melee",
        type: "untyped",
        value: 1,
        source: "Weapon Focus",
      },
    ],
  },
  {
    id: "weapon-finesse",
    name: "Weapon Finesse",
    pack: "core",
    description:
      "Use Dexterity instead of Strength on attack rolls with light/finesse weapons (specific weapon modeling not yet implemented).",
    prerequisites: [],
    tags: ["combat"],
    effects: [],
  },
  {
    id: "endurance",
    name: "Endurance",
    pack: "core",
    description: "You excel at physical endurance and environmental hardship.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "diehard",
    name: "Diehard",
    pack: "core",
    description: "You remain conscious and can act while dying.",
    prerequisites: [
      { type: "feat", featName: "Endurance", description: "Endurance" },
    ],
    effects: [],
  },
  {
    id: "eschew-materials",
    name: "Eschew Materials",
    pack: "core",
    description:
      "You can cast many spells without insignificant material components.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "master-craftsman",
    name: "Master Craftsman",
    pack: "core",
    description:
      "Exceptional mundane crafting talent can stand in for caster level prerequisites.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "craft-construct",
    name: "Craft Construct",
    pack: "core",
    description: "You can create construct magic items.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "siege-engineer",
    name: "Siege Engineer",
    pack: "core",
    description:
      "You are trained in the operation and maintenance of siege engines.",
    prerequisites: [],
    effects: [],
  },
  {
    id: "master-siege-engineer",
    name: "Master Siege Engineer",
    pack: "core",
    description: "You are an expert at commanding and employing siege weapons.",
    prerequisites: [
      {
        type: "feat",
        featName: "Siege Engineer",
        description: "Siege Engineer",
      },
    ],
    effects: [],
  },
  {
    id: "power-attack",
    name: "Power Attack",
    pack: "core",
    description:
      "Trade melee attack for damage; scales by BAB (damage not yet tracked).",
    tags: ["combat"],
    prerequisites: [
      { type: "ability", ability: "str", min: 13, description: "Str 13" },
      { type: "bab", min: 1, description: "BAB +1" },
    ],
    effects: [],
    activatable: {
      id: "power-attack",
      name: "Power Attack",
      description: "-1 melee attack / +2 melee damage per 4 BAB",
      effects: [
        {
          target: "attack.melee",
          type: "untyped",
          value: -1,
          source: "Power Attack",
        },
        {
          target: "damage.melee",
          type: "untyped",
          value: 2,
          source: "Power Attack",
        },
      ],
      scale: (ctx) => {
        const steps = babStep(ctx.baseAttackBonus);
        return [
          {
            target: "attack.melee",
            type: "untyped",
            value: -steps,
            source: "Power Attack",
          },
          {
            target: "damage.melee",
            type: "untyped",
            value: 2 * steps,
            source: "Power Attack",
          },
        ];
      },
    },
  },
  {
    id: "combat-expertise",
    name: "Combat Expertise",
    pack: "core",
    description: "Trade attack bonus for AC; scales by BAB.",
    tags: ["combat"],
    prerequisites: [
      { type: "ability", ability: "int", min: 13, description: "Int 13" },
    ],
    effects: [],
    activatable: {
      id: "combat-expertise",
      name: "Combat Expertise",
      description: "-1 attack / +1 dodge AC per 4 BAB",
      effects: [
        {
          target: "attack",
          type: "untyped",
          value: -1,
          source: "Combat Expertise",
        },
        { target: "ac", type: "dodge", value: 1, source: "Combat Expertise" },
      ],
      scale: (ctx) => {
        const steps = babStep(ctx.baseAttackBonus);
        return [
          {
            target: "attack",
            type: "untyped",
            value: -steps,
            source: "Combat Expertise",
          },
          {
            target: "ac",
            type: "dodge",
            value: steps,
            source: "Combat Expertise",
          },
        ];
      },
    },
  },
  {
    id: "deadly-aim",
    name: "Deadly Aim",
    pack: "core",
    description:
      "Trade ranged attack for damage; scales by BAB (damage not yet tracked).",
    tags: ["combat"],
    prerequisites: [
      { type: "ability", ability: "dex", min: 13, description: "Dex 13" },
      { type: "bab", min: 1, description: "BAB +1" },
    ],
    effects: [],
    activatable: {
      id: "deadly-aim",
      name: "Deadly Aim",
      description: "-1 ranged attack / +2 ranged damage per 4 BAB",
      effects: [
        {
          target: "attack.ranged",
          type: "untyped",
          value: -1,
          source: "Deadly Aim",
        },
        {
          target: "damage.ranged",
          type: "untyped",
          value: 2,
          source: "Deadly Aim",
        },
      ],
      scale: (ctx) => {
        const steps = babStep(ctx.baseAttackBonus);
        return [
          {
            target: "attack.ranged",
            type: "untyped",
            value: -steps,
            source: "Deadly Aim",
          },
          {
            target: "damage.ranged",
            type: "untyped",
            value: 2 * steps,
            source: "Deadly Aim",
          },
        ];
      },
    },
  },
];

/**
 * Savage Company (SHM Publishing) feats. Owner-authored content pack.
 * Populate from the manuscript; tagged pack: "savage-company".
 */
export const SAVAGE_COMPANY_FEATS: FeatDefinition[] = [];

/** Merge one or more feat packs into a lookup keyed by lowercased name. */
export function buildFeatRegistry(...packs: FeatDefinition[][]): FeatRegistry {
  return Object.fromEntries(
    buildCompendiumIndex(packs.flat()).all.map((feat) => [
      feat.name.toLowerCase(),
      feat,
    ]),
  );
}

/** Default registry: core + (empty) Savage Company pack. */
export const FEATS: FeatRegistry = buildFeatRegistry(
  CORE_FEATS,
  SAVAGE_COMPANY_FEATS,
);

export function getFeat(
  registry: FeatRegistry,
  name: string,
): FeatDefinition | undefined {
  return getCompendiumEntryByName(
    buildCompendiumIndex(Object.values(registry)),
    name,
  );
}

export function listFeats(registry: FeatRegistry): FeatDefinition[] {
  return Object.values(registry).sort((a, b) => a.name.localeCompare(b.name));
}

/** Collect the passive effects of the named feats from a registry. */
export function featQualifiesForGrant(
  feat: FeatDefinition,
  grantKind: FeatGrantKind,
): boolean {
  if (grantKind === "general") return true;
  if (grantKind === "fighter-bonus")
    return (feat.tags ?? []).some((tag) => tag.toLowerCase() === "combat");
  return true;
}

export function featEffects(
  featNames: string[],
  registry: FeatRegistry,
): Modifier[] {
  const out: Modifier[] = [];
  for (const name of featNames) {
    const feat = getFeat(registry, name);
    if (feat) out.push(...feat.effects);
  }
  return out;
}

// ---- Prerequisite checking ------------------------------------------------

export interface FeatContext {
  baseAttackBonus: number;
  abilityScores: Record<AbilityKey, number>;
  characterLevel: number;
  /** Names of feats the character already has. */
  featNames: string[];
}

export interface PrereqResult {
  met: boolean;
  unmet: Prerequisite[];
}

function prerequisiteMet(p: Prerequisite, ctx: FeatContext): boolean {
  switch (p.type) {
    case "bab":
      return ctx.baseAttackBonus >= (p.min ?? 0);
    case "ability":
      return p.ability ? ctx.abilityScores[p.ability] >= (p.min ?? 0) : true;
    case "character-level":
      return ctx.characterLevel >= (p.min ?? 0);
    case "feat": {
      const want = (p.featName ?? "").toLowerCase();
      return ctx.featNames.some((n) => n.toLowerCase() === want);
    }
  }
}

export function checkPrerequisites(
  feat: FeatDefinition,
  ctx: FeatContext,
): PrereqResult {
  const unmet = feat.prerequisites.filter((p) => !prerequisiteMet(p, ctx));
  return { met: unmet.length === 0, unmet };
}

/** Build a prerequisite context from a derived sheet. */
export function featContextFromSheet(sheet: DerivedSheet): FeatContext {
  const keys: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
  const abilityScores = {} as Record<AbilityKey, number>;
  for (const k of keys) abilityScores[k] = sheet.abilities[k].score;
  return {
    baseAttackBonus: sheet.baseAttackBonus,
    abilityScores,
    characterLevel: sheet.level,
    featNames: sheet.descriptor.feats.map((f) => f.name),
  };
}
