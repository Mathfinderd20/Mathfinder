import type {
  AbilityKey,
  ArmorCategory,
  Condition,
  LoadBand,
  Modifier,
  SheetDescriptor,
} from "../types";
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
  classLevels?: Record<string, number>;
  armorCategory?: ArmorCategory;
  loadBand?: LoadBand;
  conditions?: Condition[];
}

/** Serializable scaling for pools such as grit, ki, panache, or arcane pool. */
export interface ResourcePoolMaximum {
  base?: number;
  ability?: AbilityKey;
  abilityMultiplier?: number;
  className?: string;
  classLevelMultiplier?: number;
  minimum?: number;
}

export interface ResourcePoolDefinition {
  id: string;
  name: string;
  unit: string;
  description: string;
  maximum: ResourcePoolMaximum;
}

export interface ResourcePoolBonusDefinition {
  poolId: string;
  value: number;
  source: string;
}

export interface ResourcePoolContribution {
  label: string;
  value: number;
}

export interface ResourcePoolCalculation {
  contributions: ResourcePoolContribution[];
  rawTotal: number;
  minimum: number;
  total: number;
}

export interface DerivedResourcePool {
  id: string;
  name: string;
  unit: string;
  description: string;
  max: number;
  calculation: ResourcePoolCalculation;
}

export function resourcePoolCalculation(
  pool: ResourcePoolDefinition,
  context: ActivationContext,
  bonuses: ResourcePoolContribution[] = [],
): ResourcePoolCalculation {
  const maximum = pool.maximum;
  const contributions: ResourcePoolContribution[] = [];
  if (maximum.base) contributions.push({ label: "Base", value: maximum.base });
  if (maximum.ability) {
    const multiplier = maximum.abilityMultiplier ?? 1;
    const abilityModifier = context.abilityModifiers?.[maximum.ability] ?? 0;
    contributions.push({
      label: `${maximum.ability.toUpperCase()} modifier${multiplier === 1 ? "" : ` × ${multiplier}`}`,
      value: abilityModifier * multiplier,
    });
  }
  if (maximum.className) {
    const multiplier = maximum.classLevelMultiplier ?? 0;
    const classLevel =
      context.classLevels?.[maximum.className.toLowerCase()] ?? 0;
    contributions.push({
      label: `${maximum.className} levels${multiplier === 1 ? "" : ` × ${multiplier}`}`,
      value: classLevel * multiplier,
    });
  }
  contributions.push(...bonuses);
  const rawTotal = Math.floor(
    contributions.reduce(
      (total, contribution) => total + contribution.value,
      0,
    ),
  );
  const minimum = maximum.minimum ?? 0;
  return {
    contributions,
    rawTotal,
    minimum,
    total: Math.max(minimum, rawTotal),
  };
}

export function resourcePoolMaximum(
  pool: ResourcePoolDefinition,
  context: ActivationContext,
) {
  return resourcePoolCalculation(pool, context).total;
}

/** A limited-use resource pool, e.g. Rage rounds/day. */
export interface ActivatableResource {
  name: string;
  unit: string;
  /** Maximum pool size given the character context. */
  max: (ctx: ActivationContext) => number;
}

export interface ActivatableResourceCost {
  poolId: string;
  amount: number;
}

export interface ActivatableRequirements {
  maximumArmorCategory?: ArmorCategory;
  maximumLoadBand?: LoadBand;
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
  /** Cost paid from a standalone tracked pool when activated. */
  resourceCost?: ActivatableResourceCost;
  /** Serializable activation legality gates. */
  requirements?: ActivatableRequirements;
}

const ARMOR_RANK: Record<ArmorCategory, number> = {
  none: 0,
  light: 1,
  medium: 2,
  heavy: 3,
};
const LOAD_RANK: Record<LoadBand, number> = {
  light: 0,
  medium: 1,
  heavy: 2,
  overloaded: 3,
};

export function activatableRequirementFailure(
  effect: ActivatableEffect,
  context: ActivationContext,
): string | undefined {
  const requirements = effect.requirements;
  if (!requirements) return undefined;
  if (
    requirements.maximumArmorCategory &&
    context.armorCategory &&
    ARMOR_RANK[context.armorCategory] >
      ARMOR_RANK[requirements.maximumArmorCategory]
  ) {
    return `requires ${requirements.maximumArmorCategory} armor or lighter`;
  }
  if (
    requirements.maximumLoadBand &&
    context.loadBand &&
    LOAD_RANK[context.loadBand] > LOAD_RANK[requirements.maximumLoadBand]
  ) {
    return `requires a ${requirements.maximumLoadBand} load or lighter`;
  }
  return undefined;
}

/** Resolve an activatable's max resource pool, or undefined if it has none. */
export function activatableResourceMax(
  a: ActivatableEffect,
  ctx: ActivationContext,
): number | undefined {
  if (!a.resource || typeof a.resource.max !== "function") return undefined;
  return Math.max(0, a.resource.max(ctx));
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
  const suppressed = new Set(
    descriptor.suppressedFeatures.map((f) => f.name.toLowerCase()),
  );
  const out: ActivatableEffect[] = [];
  const seen = new Set<string>();
  for (const defs of Object.values(registry)) {
    for (const feature of defs) {
      if (!feature.activatable) continue;
      if (!names.has(feature.name.toLowerCase())) continue;
      if (suppressed.has(feature.name.toLowerCase())) continue;
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
    ...activatableFeaturesForDescriptor(
      args.classFeatureRegistry,
      args.descriptor,
    ),
    ...activatableFeatsForDescriptor(args.featRegistry, args.descriptor),
  ];
  const seen = new Set<string>();
  return out.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function collectResourcePools(args: {
  descriptor: SheetDescriptor;
  classFeatureRegistry: ClassFeatureRegistry;
  featRegistry: FeatRegistry;
  context: ActivationContext;
}): DerivedResourcePool[] {
  const featureNames = new Set(
    args.descriptor.features.map((feature) => feature.name.toLowerCase()),
  );
  const suppressedNames = new Set(
    args.descriptor.suppressedFeatures.map((feature) =>
      feature.name.toLowerCase(),
    ),
  );
  const featNames = new Set(
    args.descriptor.feats.map((feat) => feat.name.toLowerCase()),
  );
  const featCounts = args.descriptor.feats.reduce<Record<string, number>>(
    (counts, feat) => {
      const name = feat.name.toLowerCase();
      counts[name] = (counts[name] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const activeFeats = Object.values(args.featRegistry).filter((feat) =>
    featNames.has(feat.name.toLowerCase()),
  );
  const definitions = [
    ...Object.values(args.classFeatureRegistry)
      .flat()
      .filter(
        (feature) =>
          !!feature.resourcePool &&
          featureNames.has(feature.name.toLowerCase()) &&
          !suppressedNames.has(feature.name.toLowerCase()),
      )
      .map((feature) => feature.resourcePool!),
    ...activeFeats
      .filter((feat) => !!feat.resourcePool)
      .map((feat) => feat.resourcePool!),
  ];
  const seen = new Set<string>();
  return definitions
    .filter((definition) => {
      if (seen.has(definition.id)) return false;
      seen.add(definition.id);
      return true;
    })
    .map((definition) => {
      const bonuses = activeFeats.flatMap((feat) =>
        (feat.resourcePoolBonuses ?? [])
          .filter((bonus) => bonus.poolId === definition.id)
          .map((bonus) => {
            const count = featCounts[feat.name.toLowerCase()] ?? 1;
            return {
              label: count > 1 ? `${bonus.source} × ${count}` : bonus.source,
              value: bonus.value * count,
            };
          }),
      );
      const calculation = resourcePoolCalculation(
        definition,
        args.context,
        bonuses,
      );
      return {
        id: definition.id,
        name: definition.name,
        unit: definition.unit,
        description: definition.description,
        max: calculation.total,
        calculation,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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
    if (args.context && activatableRequirementFailure(item, args.context)) {
      suppressed.push(item);
      continue;
    }
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
