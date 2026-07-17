import { modifiersFor, resolveModifiers } from "./modifiers";
import type { BreakdownEntry, CharacterInput, DerivedStat } from "./types";

const DEFAULT_SPEED = 30;

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
