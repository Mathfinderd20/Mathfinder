export interface RuntimeHistoryRecord {
  id: string;
  at: string;
  kind: string;
  subjectId?: string;
  quantity?: number;
  note?: string;
  tags?: string[];
}

export interface RuntimeEventRecord {
  id: string;
  at: string;
  kind: string;
  subjectId?: string;
  quantity?: number;
  note?: string;
  tags?: string[];
  effectId?: string;
  effectName?: string;
  damageType?: string;
}

export type RuntimeSpellCastCounts = Record<
  string,
  Record<number, Record<string, number>>
>;
export type AttackOutcome = "hit" | "miss" | "crit";
export type WeaponTargetDefense = "normal-ac" | "touch-ac";

export interface AmmoUsageEntry {
  ammoType: string;
  amount: number;
}

export interface WeaponAttackRecord extends RuntimeHistoryRecord {
  kind: "attack";
  ammoType?: string;
  ammoSpent?: number;
  ammoEntries?: AmmoUsageEntry[];
  outcome?: AttackOutcome;
  note?: string;
}

export type WeaponAttackHistory = Record<string, WeaponAttackRecord[]>;

export interface CombatEventRecord extends RuntimeEventRecord {
  kind:
    | "attack"
    | "undo-attack"
    | "reset-weapon-history"
    | "reset-ammo"
    | "cast-spell"
    | "consume-spell-component"
    | "consume-spell-effect"
    | "apply-damage";
  attackId?: string;
  weaponName?: string;
  ammoType?: string;
  ammoDelta?: number;
  ammoEntries?: AmmoUsageEntry[];
  spellName?: string;
  itemName?: string;
  classKey?: string;
  spellLevel?: number;
  quantity?: number;
  outcome?: AttackOutcome;
  note?: string;
}

export interface RuntimeStateSnapshot {
  toggles: Record<string, boolean>;
  flags: Record<string, boolean>;
  resources: Record<string, number>;
  slotUsage: Record<string, Partial<Record<number, number>>>;
  collections: RuntimeSpellCastCounts;
  ledgers: Record<string, number>;
  histories: WeaponAttackHistory;
  events: CombatEventRecord[];
}

export type RuntimeAction =
  | { type: "reset-all" }
  | { type: "set-toggle"; id: string; value: boolean }
  | { type: "set-exclusive-toggle-group"; ids: string[]; activeId?: string }
  | { type: "set-flag"; key: string; value: boolean }
  | { type: "adjust-resource"; id: string; delta: number; max?: number }
  | { type: "reset-resource"; id: string }
  | {
      type: "adjust-spell-slot";
      classKey: string;
      level: number;
      max: number;
      delta: number;
    }
  | {
      type: "cast-spell";
      classKey: string;
      level: number;
      max: number;
      spellName: string;
      remaining: number;
      spellEffectId?: string;
      spellResourceMax?: number;
    }
  | { type: "reset-spell-class-runtime"; classKey: string; levels: number[] }
  | { type: "reset-spell-slot-level"; classKey: string; level: number }
  | { type: "clear-combat-log" }
  | {
      type: "consume-spell-component";
      spellName: string;
      itemName: string;
      quantity?: number;
      note?: string;
    }
  | { type: "reset-ammo"; ammoType?: string }
  | {
      type: "record-weapon-attack";
      weaponKey: string;
      weaponName: string;
      ammoType?: string;
      ammoSpentForAttack?: number;
      ammoEntries?: AmmoUsageEntry[];
    }
  | { type: "undo-weapon-attack"; weaponKey: string; weaponName: string }
  | {
      type: "set-weapon-attack-outcome";
      weaponKey: string;
      attackId: string;
      outcome: AttackOutcome;
    }
  | {
      type: "set-latest-weapon-attack-outcome";
      weaponKey: string;
      outcome: AttackOutcome;
    }
  | {
      type: "set-weapon-attack-note";
      weaponKey: string;
      attackId: string;
      note: string;
    }
  | { type: "set-latest-weapon-attack-note"; weaponKey: string; note: string }
  | {
      type: "consume-spell-effect";
      effectId: string;
      effectName?: string;
      amount?: number;
      note?: string;
      deactivateWhenEmpty?: boolean;
    }
  | {
      type: "apply-damage";
      amount: number;
      damageType?: string;
      hpDamageResourceId: string;
      tempHpResourceId?: string;
      spellAbsorptions?: Array<{
        effectId: string;
        effectName?: string;
        max: number;
        perHitMaximum?: number;
      }>;
    }
  | {
      type: "reset-weapon-attack-history";
      weaponKey?: string;
      weaponName?: string;
    };

export const DEFAULT_RUNTIME_EVENT_HISTORY_LIMIT = 200;

export function createRuntimeStateSnapshot(
  partial: Partial<RuntimeStateSnapshot> = {},
): RuntimeStateSnapshot {
  return {
    toggles: partial.toggles ?? {},
    flags: partial.flags ?? {},
    resources: partial.resources ?? {},
    slotUsage: partial.slotUsage ?? {},
    collections: partial.collections ?? {},
    ledgers: partial.ledgers ?? {},
    histories: partial.histories ?? {},
    events: partial.events ?? [],
  };
}

export function appendRuntimeEvent<T extends RuntimeEventRecord>(
  events: T[],
  event: T,
  maxEntries = DEFAULT_RUNTIME_EVENT_HISTORY_LIMIT,
): T[] {
  return [...events, event].slice(-maxEntries);
}

const PLURAL_AMMO_WORDS: Readonly<Record<string, string>> = {
  arrows: "arrow",
  bolts: "bolt",
  bullets: "bullet",
  cartridges: "cartridge",
  charges: "charge",
  grenades: "grenade",
  rockets: "rocket",
  rounds: "round",
  shells: "shell",
};

export function normalizeAmmoType(name: string) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  const lastIndex = words.length - 1;
  const singular = PLURAL_AMMO_WORDS[words[lastIndex] ?? ""];
  if (singular) words[lastIndex] = singular;
  return words.join(" ");
}

export function weaponTargetsDefense(args: {
  rangeFeet?: number;
  rangeIncrementFeet?: number;
  targetsTouchAcWithinFirstRangeIncrement?: boolean;
}): WeaponTargetDefense {
  if (!args.targetsTouchAcWithinFirstRangeIncrement) return "normal-ac";
  if (!args.rangeFeet || args.rangeFeet <= 0) return "touch-ac";
  if (!args.rangeIncrementFeet || args.rangeIncrementFeet <= 0)
    return "normal-ac";
  return args.rangeFeet <= args.rangeIncrementFeet ? "touch-ac" : "normal-ac";
}

export function makeCombatEvent(
  event: Omit<CombatEventRecord, "id" | "at">,
): CombatEventRecord {
  return {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
}

export function appendCombatEvent(
  events: CombatEventRecord[],
  event: Omit<CombatEventRecord, "id" | "at">,
  maxEntries = DEFAULT_RUNTIME_EVENT_HISTORY_LIMIT,
) {
  return appendRuntimeEvent(events, makeCombatEvent(event), maxEntries);
}

export function updateLedger(
  ledger: Record<string, number>,
  key: string,
  amount: number,
) {
  return { ...ledger, [key]: Math.max(0, (ledger[key] ?? 0) + amount) };
}

export function resetLedger(ledger: Record<string, number>, key?: string) {
  if (!key) return {};
  return { ...ledger, [key]: 0 };
}

export function recordWeaponAttack(args: {
  history: WeaponAttackHistory;
  events: CombatEventRecord[];
  ammoLedger: Record<string, number>;
  weaponKey: string;
  weaponName: string;
  ammoType?: string;
  ammoSpentForAttack?: number;
  ammoEntries?: AmmoUsageEntry[];
  eventHistoryLimit?: number;
}): {
  ammoLedger: Record<string, number>;
  history: WeaponAttackHistory;
  events: CombatEventRecord[];
} {
  const attackId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const attackedAt = new Date().toISOString();
  const normalizedAmmoEntries = args.ammoEntries?.length
    ? args.ammoEntries
        .map((entry) => ({
          ammoType: normalizeAmmoType(entry.ammoType),
          amount: Math.max(0, entry.amount),
        }))
        .filter((entry) => entry.ammoType && entry.amount > 0)
    : args.ammoType && (args.ammoSpentForAttack ?? 0) > 0
      ? [
          {
            ammoType: normalizeAmmoType(args.ammoType),
            amount: args.ammoSpentForAttack ?? 0,
          },
        ]
      : [];
  const normalizedAmmoType = normalizedAmmoEntries[0]?.ammoType;
  const spent = normalizedAmmoEntries.reduce(
    (ledger, entry) => updateLedger(ledger, entry.ammoType, entry.amount),
    args.ammoLedger,
  );
  const attack: WeaponAttackRecord = {
    id: attackId,
    at: attackedAt,
    kind: "attack",
    ammoType: normalizedAmmoType,
    ammoSpent: normalizedAmmoEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    ),
    ammoEntries: normalizedAmmoEntries,
  };
  return {
    ammoLedger: spent,
    history: {
      ...args.history,
      [args.weaponKey]: [...(args.history[args.weaponKey] ?? []), attack].slice(
        -(args.eventHistoryLimit ?? DEFAULT_RUNTIME_EVENT_HISTORY_LIMIT),
      ),
    },
    events: appendCombatEvent(
      args.events,
      {
        kind: "attack",
        attackId,
        weaponName: args.weaponName,
        ammoType: normalizedAmmoType,
        ammoDelta: normalizedAmmoEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0,
        ),
        ammoEntries: normalizedAmmoEntries,
      },
      args.eventHistoryLimit,
    ),
  };
}

export function undoWeaponAttack(args: {
  history: WeaponAttackHistory;
  events: CombatEventRecord[];
  ammoLedger: Record<string, number>;
  weaponKey: string;
  weaponName: string;
  eventHistoryLimit?: number;
}): {
  ammoLedger: Record<string, number>;
  history: WeaponAttackHistory;
  events: CombatEventRecord[];
} | null {
  const current = args.history[args.weaponKey] ?? [];
  const last = current[current.length - 1];
  if (!last) return null;
  const ammoLedger = (last.ammoEntries ?? []).reduce(
    (ledger, entry) =>
      entry.amount > 0
        ? updateLedger(ledger, entry.ammoType, -entry.amount)
        : ledger,
    args.ammoLedger,
  );
  return {
    ammoLedger,
    history: {
      ...args.history,
      [args.weaponKey]: current.slice(0, -1),
    },
    events: appendCombatEvent(
      args.events,
      {
        kind: "undo-attack",
        attackId: last.id,
        weaponName: args.weaponName,
        ammoType: last.ammoType,
        ammoDelta: -Math.abs(last.ammoSpent ?? 0),
        ammoEntries: last.ammoEntries,
        outcome: last.outcome,
        note: last.note,
      },
      args.eventHistoryLimit,
    ),
  };
}

export function setWeaponAttackOutcome(
  history: WeaponAttackHistory,
  events: CombatEventRecord[],
  weaponKey: string,
  attackId: string,
  outcome: AttackOutcome,
) {
  return {
    history: {
      ...history,
      [weaponKey]: (history[weaponKey] ?? []).map((entry) =>
        entry.id === attackId ? { ...entry, outcome } : entry,
      ),
    },
    events: events.map((event) =>
      event.kind === "attack" && event.attackId === attackId
        ? { ...event, outcome }
        : event,
    ),
  };
}

export function setWeaponAttackNote(
  history: WeaponAttackHistory,
  events: CombatEventRecord[],
  weaponKey: string,
  attackId: string,
  note: string,
) {
  const trimmedNote = note.trim() || undefined;
  return {
    history: {
      ...history,
      [weaponKey]: (history[weaponKey] ?? []).map((entry) =>
        entry.id === attackId ? { ...entry, note: trimmedNote } : entry,
      ),
    },
    events: events.map((event) =>
      event.kind === "attack" && event.attackId === attackId
        ? { ...event, note: trimmedNote }
        : event,
    ),
  };
}

export function resetWeaponAttackHistory(
  history: WeaponAttackHistory,
  events: CombatEventRecord[],
  ammoLedger: Record<string, number>,
  weaponKey?: string,
  weaponName?: string,
  eventHistoryLimit?: number,
) {
  const removed = weaponKey
    ? (history[weaponKey] ?? [])
    : Object.values(history).flat();
  const restoredByType = new Map<string, number>();
  for (const attack of removed) {
    for (const entry of attack.ammoEntries ?? []) {
      restoredByType.set(
        entry.ammoType,
        (restoredByType.get(entry.ammoType) ?? 0) + entry.amount,
      );
    }
  }
  const ammoEntries = [...restoredByType].map(([ammoType, amount]) => ({
    ammoType,
    amount,
  }));
  const nextAmmoLedger = ammoEntries.reduce(
    (ledger, entry) => updateLedger(ledger, entry.ammoType, -entry.amount),
    ammoLedger,
  );
  return {
    ammoLedger: nextAmmoLedger,
    history: weaponKey ? { ...history, [weaponKey]: [] } : {},
    events:
      removed.length > 0
        ? appendCombatEvent(
            events,
            {
              kind: "reset-weapon-history",
              weaponName,
              ammoDelta: -ammoEntries.reduce(
                (sum, entry) => sum + entry.amount,
                0,
              ),
              ammoEntries,
            },
            eventHistoryLimit,
          )
        : events,
  };
}

function consumeSpellEffectResource(args: {
  state: RuntimeStateSnapshot;
  effectId: string;
  effectName?: string;
  amount?: number;
  note?: string;
  deactivateWhenEmpty?: boolean;
  eventHistoryLimit: number;
}) {
  const amount = Math.max(1, args.amount ?? 1);
  const nextUsed = Math.max(
    0,
    (args.state.resources[args.effectId] ?? 0) + amount,
  );
  const nextToggles = { ...args.state.toggles };
  if (args.deactivateWhenEmpty) nextToggles[args.effectId] = false;
  return {
    ...args.state,
    toggles: nextToggles,
    resources: { ...args.state.resources, [args.effectId]: nextUsed },
    events: appendCombatEvent(
      args.state.events,
      {
        kind: "consume-spell-effect",
        effectId: args.effectId,
        effectName: args.effectName,
        quantity: amount,
        note: args.note?.trim() || undefined,
      },
      args.eventHistoryLimit,
    ),
  };
}

export function reduceRuntimeState(
  state: RuntimeStateSnapshot,
  action: RuntimeAction,
  options?: { eventHistoryLimit?: number },
): RuntimeStateSnapshot {
  const eventHistoryLimit =
    options?.eventHistoryLimit ?? DEFAULT_RUNTIME_EVENT_HISTORY_LIMIT;
  switch (action.type) {
    case "reset-all":
      return createRuntimeStateSnapshot();
    case "set-toggle": {
      if (
        action.id === "rage" &&
        action.value &&
        (state.flags.fatigued ?? false)
      )
        return state;
      const nextToggles = { ...state.toggles, [action.id]: action.value };
      const nextFlags = { ...state.flags };
      if (action.id === "rage" && state.toggles.rage && !action.value)
        nextFlags.fatigued = true;
      return { ...state, toggles: nextToggles, flags: nextFlags };
    }
    case "set-exclusive-toggle-group": {
      const next = { ...state.toggles };
      for (const id of action.ids) next[id] = false;
      if (action.activeId) next[action.activeId] = true;
      return { ...state, toggles: next };
    }
    case "set-flag": {
      const nextFlags = { ...state.flags, [action.key]: action.value };
      const nextToggles =
        action.key === "fatigued" && action.value
          ? { ...state.toggles, rage: false }
          : state.toggles;
      return { ...state, flags: nextFlags, toggles: nextToggles };
    }
    case "adjust-resource": {
      const current = state.resources[action.id] ?? 0;
      const nextValue = Math.max(
        0,
        action.max === undefined
          ? current + action.delta
          : Math.min(action.max, current + action.delta),
      );
      return {
        ...state,
        resources: { ...state.resources, [action.id]: nextValue },
      };
    }
    case "reset-resource":
      return { ...state, resources: { ...state.resources, [action.id]: 0 } };
    case "adjust-spell-slot": {
      if (action.level === 0) return state;
      return {
        ...state,
        slotUsage: {
          ...state.slotUsage,
          [action.classKey]: {
            ...(state.slotUsage[action.classKey] ?? {}),
            [action.level]: Math.min(
              action.max,
              Math.max(
                0,
                ((state.slotUsage[action.classKey] ?? {})[action.level] ?? 0) +
                  action.delta,
              ),
            ),
          },
        },
      };
    }
    case "cast-spell": {
      const slotMaximum = Math.max(0, Math.floor(action.max));
      const slotsAlreadyUsed = Math.max(
        0,
        (state.slotUsage[action.classKey] ?? {})[action.level] ?? 0,
      );
      // Derive capacity from reducer state. The UI's `remaining` value can be
      // stale when rapid clicks dispatch more than once before React rerenders.
      if (
        action.level !== 0 &&
        (!Number.isFinite(slotMaximum) || slotsAlreadyUsed >= slotMaximum)
      )
        return state;
      const slotUsage =
        action.level === 0
          ? state.slotUsage
          : {
              ...state.slotUsage,
              [action.classKey]: {
                ...(state.slotUsage[action.classKey] ?? {}),
                [action.level]: slotsAlreadyUsed + 1,
              },
            };
      return {
        ...state,
        toggles: action.spellEffectId
          ? { ...state.toggles, [action.spellEffectId]: true }
          : state.toggles,
        resources:
          action.spellEffectId && action.spellResourceMax !== undefined
            ? { ...state.resources, [action.spellEffectId]: 0 }
            : state.resources,
        slotUsage,
        collections: {
          ...state.collections,
          [action.classKey]: {
            ...(state.collections[action.classKey] ?? {}),
            [action.level]: {
              ...((state.collections[action.classKey] ?? {})[action.level] ??
                {}),
              [action.spellName]:
                (((state.collections[action.classKey] ?? {})[action.level] ??
                  {})[action.spellName] ?? 0) + 1,
            },
          },
        },
        events: appendCombatEvent(
          state.events,
          {
            kind: "cast-spell",
            classKey: action.classKey,
            spellLevel: action.level,
            spellName: action.spellName,
            note: action.spellEffectId
              ? "enabled tracked spell effect"
              : undefined,
          },
          eventHistoryLimit,
        ),
      };
    }
    case "reset-spell-class-runtime":
      return {
        ...state,
        slotUsage: {
          ...state.slotUsage,
          [action.classKey]: Object.fromEntries(
            action.levels.map((level) => [level, 0]),
          ),
        },
        collections: {
          ...state.collections,
          [action.classKey]: {},
        },
      };
    case "reset-spell-slot-level":
      return {
        ...state,
        slotUsage: {
          ...state.slotUsage,
          [action.classKey]: {
            ...(state.slotUsage[action.classKey] ?? {}),
            [action.level]: 0,
          },
        },
      };
    case "clear-combat-log":
      return { ...state, events: [] };
    case "consume-spell-component":
      return {
        ...state,
        events: appendCombatEvent(
          state.events,
          {
            kind: "consume-spell-component",
            spellName: action.spellName.trim(),
            itemName: action.itemName.trim(),
            quantity: Math.max(1, action.quantity ?? 1),
            note: action.note?.trim() || undefined,
          },
          eventHistoryLimit,
        ),
      };
    case "consume-spell-effect":
      return consumeSpellEffectResource({
        state,
        effectId: action.effectId,
        effectName: action.effectName,
        amount: action.amount,
        note: action.note,
        deactivateWhenEmpty: action.deactivateWhenEmpty,
        eventHistoryLimit,
      });
    case "apply-damage": {
      let remaining = Math.max(0, action.amount);
      const nextResources = { ...state.resources };
      const nextToggles = { ...state.toggles };
      const absorbedBits: string[] = [];
      for (const absorption of action.spellAbsorptions ?? []) {
        if (!nextToggles[absorption.effectId] || remaining <= 0) continue;
        const used = nextResources[absorption.effectId] ?? 0;
        const capacity = Math.max(0, absorption.max - used);
        if (capacity <= 0) continue;
        const perHitMaximum = Math.max(
          0,
          absorption.perHitMaximum ?? Number.POSITIVE_INFINITY,
        );
        const absorbed = Math.min(remaining, capacity, perHitMaximum);
        const nextUsed = used + absorbed;
        nextResources[absorption.effectId] = nextUsed;
        remaining -= absorbed;
        absorbedBits.push(
          `${absorption.effectName ?? absorption.effectId} ${absorbed}`,
        );
        if (nextUsed >= absorption.max)
          nextToggles[absorption.effectId] = false;
      }
      // Damage negated by a spell never reaches the character. Damage absorbed
      // by temporary HP still counts as taking damage and breaks stabilization.
      const damageReachedCharacter = remaining > 0;
      const tempHpResourceId = action.tempHpResourceId;
      if (tempHpResourceId && remaining > 0) {
        const tempHp = Math.max(0, state.resources[tempHpResourceId] ?? 0);
        const tempAbsorbed = Math.min(tempHp, remaining);
        if (tempAbsorbed > 0) {
          nextResources[tempHpResourceId] = tempHp - tempAbsorbed;
          remaining -= tempAbsorbed;
          absorbedBits.push(`temp hp ${tempAbsorbed}`);
        }
      }
      if (remaining > 0)
        nextResources[action.hpDamageResourceId] =
          Math.max(0, nextResources[action.hpDamageResourceId] ?? 0) +
          remaining;
      return {
        ...state,
        toggles: nextToggles,
        flags:
          damageReachedCharacter && state.flags.stable
            ? { ...state.flags, stable: false }
            : state.flags,
        resources: nextResources,
        events: appendCombatEvent(
          state.events,
          {
            kind: "apply-damage",
            quantity: Math.max(0, action.amount),
            damageType: action.damageType,
            note: absorbedBits.length
              ? `absorbed via ${absorbedBits.join(", ")}; hp damage ${remaining}`
              : `hp damage ${remaining}`,
          },
          eventHistoryLimit,
        ),
      };
    }
    case "reset-ammo": {
      if (!action.ammoType) {
        return {
          ...state,
          ledgers: {},
          events: appendCombatEvent(
            state.events,
            { kind: "reset-ammo" },
            eventHistoryLimit,
          ),
        };
      }
      const key = normalizeAmmoType(action.ammoType);
      return {
        ...state,
        ledgers: resetLedger(state.ledgers, key),
        events: appendCombatEvent(
          state.events,
          { kind: "reset-ammo", ammoType: key },
          eventHistoryLimit,
        ),
      };
    }
    case "record-weapon-attack": {
      const next = recordWeaponAttack({
        history: state.histories,
        events: state.events,
        ammoLedger: state.ledgers,
        weaponKey: action.weaponKey,
        weaponName: action.weaponName,
        ammoType: action.ammoType,
        ammoSpentForAttack: action.ammoSpentForAttack,
        ammoEntries: action.ammoEntries,
        eventHistoryLimit,
      });
      let nextState: RuntimeStateSnapshot = {
        ...state,
        ledgers: next.ammoLedger,
        histories: next.history,
        events: next.events,
      };
      if (nextState.toggles["spell-true-strike"])
        nextState = consumeSpellEffectResource({
          state: nextState,
          effectId: "spell-true-strike",
          effectName: "True Strike",
          note: "auto-consumed on weapon attack",
          deactivateWhenEmpty: true,
          eventHistoryLimit,
        });
      if (nextState.toggles["spell-guidance"])
        nextState = consumeSpellEffectResource({
          state: nextState,
          effectId: "spell-guidance",
          effectName: "Guidance",
          note: "consumed on tracked weapon attack",
          deactivateWhenEmpty: true,
          eventHistoryLimit,
        });
      return nextState;
    }
    case "undo-weapon-attack": {
      const next = undoWeaponAttack({
        history: state.histories,
        events: state.events,
        ammoLedger: state.ledgers,
        weaponKey: action.weaponKey,
        weaponName: action.weaponName,
        eventHistoryLimit,
      });
      if (!next) return state;
      return {
        ...state,
        ledgers: next.ammoLedger,
        histories: next.history,
        events: next.events,
      };
    }
    case "set-weapon-attack-outcome": {
      const next = setWeaponAttackOutcome(
        state.histories,
        state.events,
        action.weaponKey,
        action.attackId,
        action.outcome,
      );
      return { ...state, histories: next.history, events: next.events };
    }
    case "set-latest-weapon-attack-outcome": {
      const current = state.histories[action.weaponKey] ?? [];
      const last = current[current.length - 1];
      if (!last) return state;
      const next = setWeaponAttackOutcome(
        state.histories,
        state.events,
        action.weaponKey,
        last.id,
        action.outcome,
      );
      return { ...state, histories: next.history, events: next.events };
    }
    case "set-weapon-attack-note": {
      const next = setWeaponAttackNote(
        state.histories,
        state.events,
        action.weaponKey,
        action.attackId,
        action.note,
      );
      return { ...state, histories: next.history, events: next.events };
    }
    case "set-latest-weapon-attack-note": {
      const current = state.histories[action.weaponKey] ?? [];
      const last = current[current.length - 1];
      if (!last) return state;
      const next = setWeaponAttackNote(
        state.histories,
        state.events,
        action.weaponKey,
        last.id,
        action.note,
      );
      return { ...state, histories: next.history, events: next.events };
    }
    case "reset-weapon-attack-history": {
      const next = resetWeaponAttackHistory(
        state.histories,
        state.events,
        state.ledgers,
        action.weaponKey,
        action.weaponName,
        eventHistoryLimit,
      );
      return {
        ...state,
        ledgers: next.ammoLedger,
        histories: next.history,
        events: next.events,
      };
    }
  }
}
