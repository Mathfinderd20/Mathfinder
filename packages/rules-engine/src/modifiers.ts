import { STACKING_BONUS_TYPES, TARGET_ALIASES } from "./constants";
import type { BonusType, Modifier, ModifierTarget } from "./types";

export interface ResolvedModifiers {
  /** Net value after applying stacking rules. */
  total: number;
  /** Net value per bonus type (after stacking within the type). */
  byType: Partial<Record<BonusType, number>>;
  /** The individual modifiers that actually contributed to the total. */
  contributing: Modifier[];
}

/**
 * Filter a modifier stream to those that apply to `target`, expanding group
 * aliases (e.g. a "save.all" modifier counts toward "save.fort").
 */
export function modifiersFor(mods: Modifier[], target: ModifierTarget): Modifier[] {
  const accepted = new Set<ModifierTarget>(TARGET_ALIASES[target] ?? [target]);
  return mods.filter((m) => m.enabled !== false && accepted.has(m.target));
}

/**
 * Apply Pathfinder's stacking rules to a set of modifiers that all affect the
 * SAME target.
 *
 * Rules:
 *  - Group by bonus type.
 *  - Penalties (negative values) always stack -> sum them all.
 *  - Positive bonuses of a STACKING type (untyped/dodge/circumstance) -> sum.
 *  - Positive bonuses of any other type -> take the single highest.
 */
export function resolveModifiers(mods: Modifier[]): ResolvedModifiers {
  const groups = new Map<BonusType, Modifier[]>();
  for (const m of mods) {
    if (m.enabled === false) continue;
    const arr = groups.get(m.type);
    if (arr) arr.push(m);
    else groups.set(m.type, [m]);
  }

  const byType: Partial<Record<BonusType, number>> = {};
  const contributing: Modifier[] = [];
  let total = 0;

  for (const [type, arr] of groups) {
    const positives = arr.filter((m) => m.value > 0);
    const negatives = arr.filter((m) => m.value < 0);
    let typeTotal = 0;

    // Penalties always stack.
    for (const n of negatives) {
      typeTotal += n.value;
      contributing.push(n);
    }

    if (positives.length > 0) {
      if (STACKING_BONUS_TYPES.has(type)) {
        for (const p of positives) {
          typeTotal += p.value;
          contributing.push(p);
        }
      } else {
        const best = positives.reduce((a, b) => (b.value > a.value ? b : a));
        typeTotal += best.value;
        contributing.push(best);
      }
    }

    byType[type] = typeTotal;
    total += typeTotal;
  }

  return { total, byType, contributing };
}
