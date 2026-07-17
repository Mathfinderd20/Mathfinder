import type { ArmorCategory, Condition, LoadBand, Modifier } from "../types";
import type { ActivatableEffect } from "./activatables";

export interface ClassFeatureContext {
  armorCategory: ArmorCategory;
  loadBand: LoadBand;
  conditions: Condition[];
}

export interface SuppressedClassFeature {
  id: string;
  name: string;
  reason: string;
}

export interface ClassFeatureDefinition {
  id: string;
  name: string;
  className: string;
  level: number;
  pack: string;
  description: string;
  /** Passive effects only. */
  effects: Modifier[];
  /** Optional availability gate for passive effects. */
  availableWhen?: (ctx: ClassFeatureContext) => boolean;
  /** Human-readable explanation when unavailable. */
  unavailableReason?: (ctx: ClassFeatureContext) => string;
  /** Optional activated state, e.g. Rage. */
  activatable?: ActivatableEffect;
}

export type ClassFeatureRegistry = Record<string, ClassFeatureDefinition[]>;

/**
 * Sample class-feature progression. This is the same idea feats now use, just
 * keyed by class + level instead of picked by the player.
 */
export const CORE_CLASS_FEATURES: ClassFeatureDefinition[] = [
  {
    id: "barbarian-rage-l1",
    name: "Rage",
    className: "barbarian",
    level: 1,
    pack: "core",
    description: "Enter a rage for rounds per day.",
    effects: [],
    availableWhen: (ctx) => !ctx.conditions.includes("fatigued"),
    unavailableReason: (ctx) =>
      ctx.conditions.includes("fatigued") ? "fatigued" : "conditions not met",
    activatable: {
      id: "rage",
      name: "Rage",
      description: "+2 morale Str & Con, +2 Will, -2 AC",
      effects: [
        { target: "str", type: "morale", value: 2, source: "Rage" },
        { target: "con", type: "morale", value: 2, source: "Rage" },
        { target: "save.will", type: "morale", value: 2, source: "Rage" },
        { target: "ac", type: "untyped", value: -2, source: "Rage" },
      ],
      resource: {
        name: "Rage",
        unit: "rounds/day",
        // 4 + Con mod at 1st level, +2 per level after (single-class assumption).
        max: (ctx) =>
          4 +
          (ctx.abilityModifiers?.con ?? 0) +
          2 * Math.max(0, ctx.characterLevel - 1),
      },
    },
  },
  {
    id: "barbarian-fast-movement-l1",
    name: "Fast Movement",
    className: "barbarian",
    level: 1,
    pack: "core",
    description:
      "+10 ft enhancement to land speed unless reduced by encumbrance.",
    effects: [
      {
        target: "speed",
        type: "enhancement",
        value: 10,
        source: "Fast Movement",
      },
    ],
    availableWhen: (ctx) => ctx.loadBand === "light",
    unavailableReason: (ctx) => {
      if (ctx.loadBand !== "light") return `${ctx.loadBand} load`;
      return "conditions not met";
    },
  },
  {
    id: "fighter-bonus-feat-l1",
    name: "Bonus Feat",
    className: "fighter",
    level: 1,
    pack: "core",
    description: "A fighter gains a bonus combat feat at 1st level.",
    effects: [],
  },
  {
    id: "rogue-trapfinding-l1",
    name: "Trapfinding",
    className: "rogue",
    level: 1,
    pack: "core",
    description:
      "+1 bonus on Perception to locate traps and Disable Device on traps.",
    effects: [],
  },
];

export const SAVAGE_COMPANY_CLASS_FEATURES: ClassFeatureDefinition[] = [];

export function buildClassFeatureRegistry(
  ...packs: ClassFeatureDefinition[][]
): ClassFeatureRegistry {
  const registry: ClassFeatureRegistry = {};
  for (const pack of packs) {
    for (const feature of pack) {
      const key = feature.className.toLowerCase();
      const arr = registry[key];
      if (arr) arr.push(feature);
      else registry[key] = [feature];
    }
  }
  for (const key of Object.keys(registry)) {
    registry[key]!.sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name),
    );
  }
  return registry;
}

export const CLASS_FEATURES: ClassFeatureRegistry = buildClassFeatureRegistry(
  CORE_CLASS_FEATURES,
  SAVAGE_COMPANY_CLASS_FEATURES,
);

export function classFeaturesGrantedAt(
  registry: ClassFeatureRegistry,
  className: string,
  classLevel: number,
): ClassFeatureDefinition[] {
  return (registry[className.toLowerCase()] ?? []).filter(
    (f) => f.level === classLevel,
  );
}

export function classFeatureEffects(
  features: ClassFeatureDefinition[],
  ctx?: ClassFeatureContext,
): Modifier[] {
  return features.flatMap((f) => {
    if (f.availableWhen && ctx && !f.availableWhen(ctx)) return [];
    return f.effects;
  });
}

export function suppressedClassFeatures(
  features: ClassFeatureDefinition[],
  ctx?: ClassFeatureContext,
): SuppressedClassFeature[] {
  if (!ctx) return [];
  const out: SuppressedClassFeature[] = [];
  for (const f of features) {
    if (f.availableWhen && !f.availableWhen(ctx)) {
      out.push({
        id: f.id,
        name: f.name,
        reason: f.unavailableReason
          ? f.unavailableReason(ctx)
          : "conditions not met",
      });
    }
  }
  return out;
}
