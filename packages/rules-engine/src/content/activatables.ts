import type { AbilityKey, Modifier, SheetDescriptor } from "../types";
import type { ClassFeatureRegistry } from "./class-features";
import type { FeatRegistry } from "./feats";

/**
 * A toggleable combat/runtime state sourced from content.
 * Examples: Rage, Combat Expertise, Power Attack, Bardic Performance.
 */
/** Runtime context an activatable may scale against (BAB, level, ability mods). */
export interface ActivationContext {
  baseAttackBonus: number;
  characterLevel: number;
  abilityModifiers?: Record<AbilityKey, number>;
}

/** A limited-use resource pool, e.g. Rage rounds/day. */
export interface ActivatableResource {
  name: string;
  unit: string;
  /** Maximum pool size given the character context. */
  max: (ctx: ActivationContext) => number;
}

export interface ActivatableEffect {
  id: string;
  name: string;
  description: string;
  /** Static effects, used as the fallback when no scaling/context is supplied. */
  effects: Modifier[];
  /** Optional BAB/level scaling. When present and a context is given, replaces `effects`. */
  scale?: (ctx: ActivationContext) => Modifier[];
  /** Optional exclusivity bucket, e.g. "attack-mode". */
  group?: string;
  /** Optional limited-use resource pool, e.g. Rage rounds/day. */
  resource?: ActivatableResource;
}

/** Resolve an activatable's max resource pool, or undefined if it has none. */
export function activatableResourceMax(
  a: ActivatableEffect,
  ctx: ActivationContext,
): number | undefined {
  return a.resource ? Math.max(0, a.resource.max(ctx)) : undefined;
}

/** Resolve an activatable's modifiers, applying scaling when a context is given. */
export function activatableModifiers(
  a: ActivatableEffect,
  context?: ActivationContext,
): Modifier[] {
  return a.scale && context ? a.scale(context) : a.effects;
}

/** Per-4-BAB step count used by Power Attack / Combat Expertise / Deadly Aim. */
export function babStep(baseAttackBonus: number): number {
  return 1 + Math.floor(baseAttackBonus / 4);
}

export interface ActivatableConflict {
  group: string;
  ids: string[];
}

export interface ResolvedActivatables {
  active: ActivatableEffect[];
  suppressed: ActivatableEffect[];
  modifiers: Modifier[];
  conflicts: ActivatableConflict[];
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

export function resolveActivatableSelections(args: {
  available: ActivatableEffect[];
  selected: Record<string, boolean>;
  context?: ActivationContext;
}): ResolvedActivatables {
  const picked = args.available.filter((a) => args.selected[a.id]);
  const grouped = new Map<string, ActivatableEffect[]>();
  const active: ActivatableEffect[] = [];
  const suppressed: ActivatableEffect[] = [];
  const conflicts: ActivatableConflict[] = [];

  for (const item of picked) {
    if (!item.group) {
      active.push(item);
      continue;
    }
    const arr = grouped.get(item.group);
    if (arr) arr.push(item);
    else grouped.set(item.group, [item]);
  }

  for (const [group, items] of grouped) {
    active.push(items[0]!);
    if (items.length > 1) {
      suppressed.push(...items.slice(1));
      conflicts.push({ group, ids: items.map((i) => i.id) });
    }
  }

  active.sort((a, b) => a.name.localeCompare(b.name));
  suppressed.sort((a, b) => a.name.localeCompare(b.name));

  return {
    active,
    suppressed,
    modifiers: active.flatMap((a) => activatableModifiers(a, args.context)),
    conflicts,
  };
}

export function groupActivatables(available: ActivatableEffect[]): {
  grouped: Record<string, ActivatableEffect[]>;
  ungrouped: ActivatableEffect[];
} {
  const grouped: Record<string, ActivatableEffect[]> = {};
  const ungrouped: ActivatableEffect[] = [];
  for (const item of available) {
    if (!item.group) {
      ungrouped.push(item);
      continue;
    }
    const arr = (grouped[item.group] ??= []);
    arr.push(item);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key]!.sort((a, b) => a.name.localeCompare(b.name));
  }
  ungrouped.sort((a, b) => a.name.localeCompare(b.name));
  return { grouped, ungrouped };
}
