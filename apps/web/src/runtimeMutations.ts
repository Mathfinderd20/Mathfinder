import type { RuntimeAction } from "@mathfinder/rules-engine";

export const HP_DAMAGE_RESOURCE_ID = "hp-damage";
export const TEMP_HP_RESOURCE_ID = "temp-hp";
export const NONLETHAL_DAMAGE_RESOURCE_ID = "nonlethal-damage";
export const STABLE_FLAG_ID = "stable";
export const DIEHARD_ACTIVE_FLAG_ID = "diehard-active";
export const FEROCITY_ACTIVE_FLAG_ID = "ferocity-active";
export const FEROCITY_USED_FLAG_ID = "ferocity-used";

export function healingRuntimeActions(args: {
  amount: number;
  currentHp: number;
  maxHp: number;
  dead: boolean;
}): RuntimeAction[] {
  const amount = Math.max(0, args.amount);
  if (amount <= 0 || args.dead) return [];
  const nextHp = Math.min(args.maxHp, args.currentHp + amount);
  return [
    { type: "adjust-resource", id: HP_DAMAGE_RESOURCE_ID, delta: -amount },
    { type: "set-flag", key: STABLE_FLAG_ID, value: nextHp < 0 },
  ];
}

export function directHpLossRuntimeActions(amount: number): RuntimeAction[] {
  const normalized = Math.max(0, amount);
  if (normalized <= 0) return [];
  return [
    {
      type: "adjust-resource",
      id: HP_DAMAGE_RESOURCE_ID,
      delta: normalized,
    },
    { type: "set-flag", key: STABLE_FLAG_ID, value: false },
  ];
}

export function resetHealthRuntimeActions(): RuntimeAction[] {
  return [
    { type: "reset-resource", id: HP_DAMAGE_RESOURCE_ID },
    { type: "reset-resource", id: TEMP_HP_RESOURCE_ID },
    { type: "reset-resource", id: NONLETHAL_DAMAGE_RESOURCE_ID },
    { type: "set-flag", key: STABLE_FLAG_ID, value: false },
    { type: "set-flag", key: DIEHARD_ACTIVE_FLAG_ID, value: false },
    { type: "set-flag", key: FEROCITY_ACTIVE_FLAG_ID, value: false },
    { type: "set-flag", key: FEROCITY_USED_FLAG_ID, value: false },
  ];
}
