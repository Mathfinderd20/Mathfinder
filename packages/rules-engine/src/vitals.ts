import { modifiersFor, resolveModifiers } from "./modifiers";
import type { BreakdownEntry, CharacterInput, DerivedStat } from "./types";

const DEFAULT_SPEED = 30;

export type HealthCondition =
  | "healthy"
  | "wounded"
  | "staggered"
  | "unconscious"
  | "disabled"
  | "dying"
  | "stable"
  | "dead";

export interface HealthStatus {
  condition: HealthCondition;
  deathThreshold: number;
  conscious: boolean;
  canAct: boolean;
}

export interface StabilizationCheckResult {
  roll: number;
  modifier: number;
  total: number;
  dc: 10;
  success: boolean;
  hpLoss: 0 | 1;
}

export function deriveHealthStatus(args: {
  maxHp: number;
  currentHp: number;
  constitutionScore: number;
  nonlethalDamage?: number;
  stable?: boolean;
}): HealthStatus {
  const deathThreshold = -Math.max(1, args.constitutionScore);
  const nonlethalDamage = Math.max(0, args.nonlethalDamage ?? 0);
  const condition: HealthCondition =
    args.currentHp <= deathThreshold
      ? "dead"
      : args.currentHp < 0
        ? args.stable
          ? "stable"
          : "dying"
        : nonlethalDamage > args.currentHp
          ? "unconscious"
          : args.currentHp === 0
            ? "disabled"
            : nonlethalDamage === args.currentHp && nonlethalDamage > 0
              ? "staggered"
              : args.currentHp < args.maxHp
                ? "wounded"
                : "healthy";
  return {
    condition,
    deathThreshold,
    conscious: !["unconscious", "dying", "stable", "dead"].includes(condition),
    canAct: !["unconscious", "dying", "stable", "dead"].includes(condition),
  };
}

export function stabilizationCheck(
  currentHp: number,
  constitutionScore: number,
  roll: number,
): StabilizationCheckResult {
  const normalizedRoll = Math.max(1, Math.min(20, Math.floor(roll)));
  const constitutionModifier = Math.floor((constitutionScore - 10) / 2);
  const modifier = constitutionModifier + Math.min(0, currentHp);
  const total = normalizedRoll + modifier;
  const success = normalizedRoll === 20 || total >= 10;
  return {
    roll: normalizedRoll,
    modifier,
    total,
    dc: 10,
    success,
    hpLoss: success ? 0 : 1,
  };
}

/**
 * Max HP = sum over hit dice of max(1, rolled + Con mod) + misc HP modifiers.
 *
 * The per-die max(1, ...) enforces Pathfinder's "minimum 1 HP gained per Hit
 * Die" rule even when Constitution is low.
 */
export function deriveHitPoints(
  input: CharacterInput,
  conMod: number,
): DerivedStat {
  const rolled = input.rolledHitPoints ?? [];
  let fromHitDice = 0;
  for (const r of rolled) {
    fromHitDice += Math.max(1, r + conMod);
  }

  const breakdown: BreakdownEntry[] = [
    {
      source: `${rolled.length} Hit ${rolled.length === 1 ? "Die" : "Dice"} (Con-adjusted)`,
      type: "base",
      value: fromHitDice,
    },
  ];

  for (const m of resolveModifiers(modifiersFor(input.modifiers, "hp"))
    .contributing) {
    breakdown.push({ source: m.source, type: m.type, value: m.value });
  }

  const total = breakdown.reduce((sum, entry) => sum + entry.value, 0);
  return { total, breakdown };
}

/** Land speed = base speed + speed modifiers (armor/encumbrance arrive as modifiers). */
export function deriveSpeed(input: CharacterInput): DerivedStat {
  const base = input.baseSpeed ?? DEFAULT_SPEED;
  const breakdown: BreakdownEntry[] = [
    { source: "base speed", type: "base", value: base },
  ];

  for (const m of resolveModifiers(modifiersFor(input.modifiers, "speed"))
    .contributing) {
    breakdown.push({ source: m.source, type: m.type, value: m.value });
  }

  const total = breakdown.reduce((sum, entry) => sum + entry.value, 0);
  return { total, breakdown };
}
