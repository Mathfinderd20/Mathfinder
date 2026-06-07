import type { Modifier, SheetDescriptor } from "../types";

export interface ActivatableFeature {
  id: string;
  name: string;
  description: string;
  effects: Modifier[];
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
  /** Optional activated state, e.g. Rage. */
  activatable?: ActivatableFeature;
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
    },
  },
  {
    id: "barbarian-fast-movement-l1",
    name: "Fast Movement",
    className: "barbarian",
    level: 1,
    pack: "core",
    description: "+10 ft enhancement to land speed when in light/no armor and not heavily loaded.",
    effects: [{ target: "speed", type: "enhancement", value: 10, source: "Fast Movement" }],
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
    description: "+1 bonus on Perception to locate traps and Disable Device on traps.",
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
    registry[key]!.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
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
  return (registry[className.toLowerCase()] ?? []).filter((f) => f.level === classLevel);
}

export function classFeatureEffects(features: ClassFeatureDefinition[]): Modifier[] {
  return features.flatMap((f) => f.effects);
}

export function activatableClassFeatures(features: ClassFeatureDefinition[]): ActivatableFeature[] {
  return features.flatMap((f) => (f.activatable ? [f.activatable] : []));
}

/** Resolve activatable features visible on a sheet descriptor into toggle defs. */
export function activatableFeaturesForDescriptor(
  registry: ClassFeatureRegistry,
  descriptor: SheetDescriptor,
): ActivatableFeature[] {
  const names = new Set(descriptor.features.map((f) => f.name.toLowerCase()));
  const out: ActivatableFeature[] = [];
  const seen = new Set<string>();
  for (const defs of Object.values(registry)) {
    for (const feature of defs) {
      if (!feature.activatable) continue;
      if (!names.has(feature.name.toLowerCase())) continue;
      if (seen.has(feature.activatable.id)) continue;
      seen.add(feature.activatable.id);
      out.push(feature.activatable);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
