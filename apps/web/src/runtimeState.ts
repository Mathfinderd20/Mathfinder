import {
  createRuntimeStateSnapshot,
  type CombatEventRecord,
  type RuntimeSpellCastCounts,
  type RuntimeStateSnapshot,
  type WeaponAttackHistory,
} from "@mathfinder/rules-engine";

export type {
  AttackOutcome,
  CombatEventRecord,
  WeaponAttackHistory,
  WeaponAttackRecord,
} from "@mathfinder/rules-engine";
export type SpellCastCounts = RuntimeSpellCastCounts;
export type AppRuntimeStateSnapshot = RuntimeStateSnapshot;

export interface LegacyRuntimeStateSnapshot {
  activeBuffs?: Record<string, boolean>;
  resourcesUsed?: Record<string, number>;
  spellSlotUsage?: RuntimeStateSnapshot["slotUsage"];
  spellCastCounts?: SpellCastCounts;
  ammoSpent?: Record<string, number>;
  weaponAttackHistory?: WeaponAttackHistory;
  combatEventLog?: CombatEventRecord[];
  fatigued?: boolean;
}

export function createAppRuntimeState(
  partial: Partial<AppRuntimeStateSnapshot> = {},
): AppRuntimeStateSnapshot {
  return createRuntimeStateSnapshot(partial);
}

export function loadAppRuntimeState(
  raw: string | null | undefined,
): AppRuntimeStateSnapshot {
  if (!raw) return createAppRuntimeState();
  const parsed = JSON.parse(raw) as Partial<
    AppRuntimeStateSnapshot & LegacyRuntimeStateSnapshot
  >;
  if (
    "activeBuffs" in parsed ||
    "resourcesUsed" in parsed ||
    "fatigued" in parsed
  ) {
    return createAppRuntimeState({
      toggles: parsed.activeBuffs ?? {},
      flags: { fatigued: parsed.fatigued ?? false },
      resources: parsed.resourcesUsed ?? {},
      slotUsage: parsed.spellSlotUsage ?? {},
      collections: parsed.spellCastCounts ?? {},
      ledgers: parsed.ammoSpent ?? {},
      histories: parsed.weaponAttackHistory ?? {},
      events: parsed.combatEventLog ?? [],
    });
  }
  return createAppRuntimeState(parsed);
}
