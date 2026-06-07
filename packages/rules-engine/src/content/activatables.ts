import type { Modifier, SheetDescriptor } from "../types";
import type { ClassFeatureRegistry } from "./class-features";
import type { FeatRegistry } from "./feats";

/**
 * A toggleable combat/runtime state sourced from content.
 * Examples: Rage, Combat Expertise, Power Attack, Bardic Performance.
 */
export interface ActivatableEffect {
  id: string;
  name: string;
  description: string;
  effects: Modifier[];
  /** Optional exclusivity bucket for future stance/mode logic. */
  group?: string;
}

export function activatableFeaturesForDescriptor(
  registry: ClassFeatureRegistry,
  descriptor: SheetDescriptor,
): ActivatableEffect[] {
  const names = new Set(descriptor.features.map((f) => f.name.toLowerCase()));
  const out: ActivatableEffect[] = [];
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

export function activatableFeatsForDescriptor(
  registry: FeatRegistry,
  descriptor: SheetDescriptor,
): ActivatableEffect[] {
  const names = new Set(descriptor.feats.map((f) => f.name.toLowerCase()));
  const out: ActivatableEffect[] = [];
  const seen = new Set<string>();
  for (const feat of Object.values(registry)) {
    if (!feat.activatable) continue;
    if (!names.has(feat.name.toLowerCase())) continue;
    if (seen.has(feat.activatable.id)) continue;
    seen.add(feat.activatable.id);
    out.push(feat.activatable);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectActivatableEffects(args: {
  descriptor: SheetDescriptor;
  classFeatureRegistry: ClassFeatureRegistry;
  featRegistry: FeatRegistry;
}): ActivatableEffect[] {
  const out = [
    ...activatableFeaturesForDescriptor(args.classFeatureRegistry, args.descriptor),
    ...activatableFeatsForDescriptor(args.featRegistry, args.descriptor),
  ];
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
