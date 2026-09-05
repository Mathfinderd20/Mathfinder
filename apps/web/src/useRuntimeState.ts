import { useEffect, useMemo, useReducer } from "react";
import {
  getSpellEffectByName,
  reduceRuntimeState,
  type AttackOutcome,
  type RuntimeAction,
} from "@mathfinder/rules-engine";
import { createAppRuntimeState, loadAppRuntimeState } from "./runtimeState";
import { LOCAL_DATA_CHANGED_EVENT } from "./features/characters/characterRepository";

export function useRuntimeState(storageKey: string) {
  const [state, dispatch] = useReducer(
    (
      runtimeState: ReturnType<typeof createAppRuntimeState>,
      action: RuntimeAction,
    ) => reduceRuntimeState(runtimeState, action),
    undefined,
    () => {
      if (typeof window === "undefined") return createAppRuntimeState();
      try {
        return loadAppRuntimeState(window.localStorage.getItem(storageKey));
      } catch {
        return createAppRuntimeState();
      }
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent(LOCAL_DATA_CHANGED_EVENT, {
        detail: { resource: "runtime", storageKey },
      }),
    );
  }, [state, storageKey]);

  const actions = useMemo(
    () => ({
      applyActions: (runtimeActions: RuntimeAction[]) =>
        dispatch({ type: "batch", actions: runtimeActions }),
      resetAll: () => dispatch({ type: "reset-all" }),
      setToggle: (id: string, value: boolean) =>
        dispatch({ type: "set-toggle", id, value }),
      setExclusiveToggleGroup: (ids: string[], activeId?: string) =>
        dispatch({ type: "set-exclusive-toggle-group", ids, activeId }),
      setFlag: (key: string, value: boolean) =>
        dispatch({ type: "set-flag", key, value }),
      adjustResource: (id: string, delta: number, max?: number) =>
        dispatch({ type: "adjust-resource", id, delta, max }),
      resetResource: (id: string) => dispatch({ type: "reset-resource", id }),
      adjustSpellSlot: (
        classKey: string,
        level: number,
        max: number,
        delta: number,
      ) => dispatch({ type: "adjust-spell-slot", classKey, level, max, delta }),
      castSpell: (
        classKey: string,
        level: number,
        max: number,
        spellName: string,
        remaining: number,
        spellResourceMax?: number,
      ) =>
        dispatch({
          type: "cast-spell",
          classKey,
          level,
          max,
          spellName,
          remaining,
          spellEffectId: getSpellEffectByName(spellName)?.id,
          spellResourceMax,
        }),
      resetSpellClassRuntime: (classKey: string, levels: number[]) =>
        dispatch({ type: "reset-spell-class-runtime", classKey, levels }),
      resetSpellSlotLevel: (classKey: string, level: number) =>
        dispatch({ type: "reset-spell-slot-level", classKey, level }),
      clearCombatEventLog: () => dispatch({ type: "clear-combat-log" }),
      consumeSpellEffect: (
        effectId: string,
        effectName?: string,
        amount = 1,
        note?: string,
        deactivateWhenEmpty = false,
      ) =>
        dispatch({
          type: "consume-spell-effect",
          effectId,
          effectName,
          amount,
          note,
          deactivateWhenEmpty,
        }),
      applyTrackedDamage: (
        amount: number,
        damageType: string | undefined,
        hpDamageResourceId: string,
        tempHpResourceId?: string,
        spellAbsorptions?: Array<{
          effectId: string;
          effectName?: string;
          max: number;
          perHitMaximum?: number;
        }>,
      ) =>
        dispatch({
          type: "apply-damage",
          amount,
          damageType,
          hpDamageResourceId,
          tempHpResourceId,
          spellAbsorptions,
        }),
      consumeSpellComponent: (
        spellName: string,
        itemName: string,
        quantity = 1,
        note?: string,
      ) =>
        dispatch({
          type: "consume-spell-component",
          spellName,
          itemName,
          quantity,
          note,
        }),
      resetAmmo: (ammoType?: string) =>
        dispatch({ type: "reset-ammo", ammoType }),
      recordWeaponAttack: (
        weaponKey: string,
        weaponName: string,
        ammoType?: string,
        ammoSpentForAttack?: number,
        ammoEntries?: Array<{ ammoType: string; amount: number }>,
      ) =>
        dispatch({
          type: "record-weapon-attack",
          weaponKey,
          weaponName,
          ammoType,
          ammoSpentForAttack,
          ammoEntries,
        }),
      undoWeaponAttack: (weaponKey: string, weaponName: string) =>
        dispatch({ type: "undo-weapon-attack", weaponKey, weaponName }),
      setWeaponAttackOutcome: (
        weaponKey: string,
        attackId: string,
        outcome: AttackOutcome,
      ) =>
        dispatch({
          type: "set-weapon-attack-outcome",
          weaponKey,
          attackId,
          outcome,
        }),
      tagLatestWeaponAttackOutcome: (
        weaponKey: string,
        outcome: AttackOutcome,
      ) =>
        dispatch({
          type: "set-latest-weapon-attack-outcome",
          weaponKey,
          outcome,
        }),
      setWeaponAttackNote: (
        weaponKey: string,
        attackId: string,
        note: string,
      ) =>
        dispatch({ type: "set-weapon-attack-note", weaponKey, attackId, note }),
      setLatestWeaponAttackNote: (weaponKey: string, note: string) =>
        dispatch({ type: "set-latest-weapon-attack-note", weaponKey, note }),
      resetWeaponAttackHistory: (weaponKey?: string, weaponName?: string) =>
        dispatch({
          type: "reset-weapon-attack-history",
          weaponKey,
          weaponName,
        }),
    }),
    [],
  );

  return {
    runtimeState: state,
    activeBuffs: state.toggles,
    resourcesUsed: state.resources,
    spellSlotUsage: state.slotUsage,
    spellCastCounts: state.collections,
    ammoSpent: state.ledgers,
    weaponAttackHistory: state.histories,
    combatEventLog: state.events,
    fatigued: state.flags.fatigued ?? false,
    stable: state.flags.stable ?? false,
    diehardActive: state.flags["diehard-active"] ?? false,
    ferocityActive: state.flags["ferocity-active"] ?? false,
    ferocityUsed: state.flags["ferocity-used"] ?? false,
    bleeding: state.flags.bleeding ?? false,
    ...actions,
  };
}

export type RuntimeStateController = ReturnType<typeof useRuntimeState>;
