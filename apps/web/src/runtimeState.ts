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

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function booleanRecord(value: unknown): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(objectRecord(value) ?? {}).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function numberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(objectRecord(value) ?? {}).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

export function loadAppRuntimeState(
  raw: string | null | undefined,
): AppRuntimeStateSnapshot {
  if (!raw) return createAppRuntimeState();
  let parsed: Partial<AppRuntimeStateSnapshot & LegacyRuntimeStateSnapshot>;
  try {
    const value: unknown = JSON.parse(raw);
    parsed = objectRecord(value) ?? {};
  } catch {
    return createAppRuntimeState();
  }
  if (
    "activeBuffs" in parsed ||
    "resourcesUsed" in parsed ||
    "fatigued" in parsed
  ) {
    return createAppRuntimeState({
      toggles: booleanRecord(parsed.activeBuffs),
      flags: { fatigued: parsed.fatigued === true },
      resources: numberRecord(parsed.resourcesUsed),
      slotUsage: objectRecord(parsed.spellSlotUsage)
        ? parsed.spellSlotUsage
        : {},
      collections: objectRecord(parsed.spellCastCounts)
        ? parsed.spellCastCounts
        : {},
      ledgers: numberRecord(parsed.ammoSpent),
      histories: objectRecord(parsed.weaponAttackHistory)
        ? parsed.weaponAttackHistory
        : {},
      events: Array.isArray(parsed.combatEventLog) ? parsed.combatEventLog : [],
    });
  }
  return createAppRuntimeState({
    toggles: booleanRecord(parsed.toggles),
    flags: booleanRecord(parsed.flags),
    resources: numberRecord(parsed.resources),
    slotUsage: objectRecord(parsed.slotUsage) ? parsed.slotUsage : {},
    collections: objectRecord(parsed.collections) ? parsed.collections : {},
    ledgers: numberRecord(parsed.ledgers),
    histories: objectRecord(parsed.histories) ? parsed.histories : {},
    events: Array.isArray(parsed.events) ? parsed.events : [],
  });
}
