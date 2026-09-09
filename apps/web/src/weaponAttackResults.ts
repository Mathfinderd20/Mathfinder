import type { WeaponAttackRolls } from "@mathfinder/rules-engine";

/** Snapshot rolls with the modifiers at attack time, not when the log is viewed. */
export function weaponAttackResults(
  attackInput: string | undefined,
  damageInput: string | undefined,
  attackBonus: number,
  damageBonus: number,
  criticalMultiplier: number,
): WeaponAttackRolls {
  const parse = (input: string | undefined) =>
    input?.trim() && Number.isFinite(Number(input)) ? Number(input) : undefined;
  const attackRoll = parse(attackInput);
  const damageRoll = parse(damageInput);
  return {
    ...(attackRoll === undefined
      ? {}
      : { attackRoll, attackTotal: attackRoll + attackBonus }),
    ...(damageRoll === undefined
      ? {}
      : { damageRoll, damageTotal: damageRoll + damageBonus }),
    criticalMultiplier,
  };
}
