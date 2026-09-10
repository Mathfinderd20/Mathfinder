import type { Dispatch, SetStateAction } from "react";
import {
  getSpellEffectByName,
  normalizeAmmoType,
  spellEffectResourceMax,
  type CharacterBuild,
  type SpellEffectRuntimeContext,
  type WeaponAttackHistory,
  type WeaponAttackRolls,
} from "@mathfinder/rules-engine";
import {
  consumeAmmoFromEquipment,
  consumeSpellComponentFromEquipment,
  restoreAmmoToEquipment,
} from "../equipmentTools";
import type { RuntimeStateController } from "../useRuntimeState";

export function restoreAttackHistoryAmmo(
  equipment: CharacterBuild["equipment"],
  history: WeaponAttackHistory,
  ammoSpent: Record<string, number>,
  weaponKey?: string,
  campaignRules?: CharacterBuild["campaignRules"],
) {
  const attacks = weaponKey
    ? (history[weaponKey] ?? [])
    : Object.values(history).flat();
  const totals = new Map<string, number>();
  for (const attack of attacks) {
    for (const entry of attack.ammoEntries ?? []) {
      totals.set(
        entry.ammoType,
        (totals.get(entry.ammoType) ?? 0) + entry.amount,
      );
    }
  }
  return [...totals].reduce(
    (current, [ammoType, amount]) =>
      restoreAmmoToEquipment(
        current,
        ammoType,
        Math.min(amount, ammoSpent[ammoType] ?? 0),
        campaignRules,
      ),
    equipment ?? [],
  );
}

export function useCombatEquipmentRuntime(
  build: CharacterBuild,
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
  spellEffectContext: SpellEffectRuntimeContext,
  runtime: RuntimeStateController,
) {
  function castSpell(
    classKey: string,
    level: number,
    max: number,
    spellName: string,
    remaining: number,
    applySelfEffect = true,
  ) {
    const effect = getSpellEffectByName(spellName);
    const spellResourceMax = effect
      ? spellEffectResourceMax(effect, spellEffectContext)
      : undefined;
    runtime.castSpell(
      classKey,
      level,
      max,
      spellName,
      remaining,
      spellResourceMax,
      applySelfEffect,
    );
    const consumption = consumeSpellComponentFromEquipment(
      build.equipment ?? [],
      spellName,
    );
    if (consumption.consumedItems.length > 0) {
      setBuild((previous) => ({
        ...previous,
        equipment: consumption.equipment,
      }));
    }
    for (const consumed of consumption.consumedItems) {
      runtime.consumeSpellComponent(
        spellName,
        consumed.itemName,
        consumed.quantity,
        consumption.consumedItems.length > 1
          ? "multi-item spell trigger"
          : undefined,
      );
    }
  }

  function setSheetWeaponLoadedAmmo(
    sourceKind: "build" | "equipment" | "race" | undefined,
    sourceIndex: number | undefined,
    loadedAmmoType?: string,
  ) {
    if (sourceKind === "race" || sourceIndex == null) return;
    setBuild((previous) => {
      if (sourceKind === "build") {
        const weapons = [...(previous.weapons ?? [])];
        const weapon = weapons[sourceIndex];
        if (!weapon) return previous;
        weapons[sourceIndex] = { ...weapon, loadedAmmoType };
        return { ...previous, weapons };
      }
      const equipment = [...(previous.equipment ?? [])];
      const item = equipment[sourceIndex];
      if (!item?.weapon) return previous;
      equipment[sourceIndex] = {
        ...item,
        weapon: { ...item.weapon, loadedAmmoType },
      };
      return { ...previous, equipment };
    });
  }

  function recordWeaponAttack(
    weaponKey: string,
    weaponName: string,
    ammoType?: string,
    ammoSpentForAttack?: number,
    attackNote?: string,
    ammoEntries?: Array<{ ammoType: string; amount: number }>,
    rolls?: WeaponAttackRolls,
  ) {
    const requestedEntries = (ammoEntries ?? [])
      .filter((entry) => entry.amount > 0 && entry.ammoType?.trim())
      .map((entry) => ({ ...entry, amount: Math.max(0, entry.amount) }));
    const fallbackEntries =
      requestedEntries.length > 0
        ? requestedEntries
        : ammoType && (ammoSpentForAttack ?? 0) > 0
          ? [{ ammoType, amount: Math.max(0, ammoSpentForAttack ?? 0) }]
          : [];
    let nextEquipment = build.equipment ?? [];
    const consumedEntries = fallbackEntries.map((entry) => {
      const next = consumeAmmoFromEquipment(
        nextEquipment,
        entry.ammoType,
        entry.amount,
      );
      nextEquipment = next.equipment;
      return { ammoType: entry.ammoType, amount: next.consumed };
    });
    if (consumedEntries.some((entry) => entry.amount > 0)) {
      setBuild((previous) => ({ ...previous, equipment: nextEquipment }));
    }
    runtime.recordWeaponAttack(
      weaponKey,
      weaponName,
      consumedEntries[0]?.ammoType ?? ammoType,
      consumedEntries[0]?.amount ?? ammoSpentForAttack,
      consumedEntries,
      rolls,
    );
    if (attackNote?.trim()) {
      runtime.setLatestWeaponAttackNote(weaponKey, attackNote.trim());
    }
  }

  function undoWeaponAttack(weaponKey: string, weaponName: string) {
    const attacks = runtime.weaponAttackHistory[weaponKey] ?? [];
    const last = attacks[attacks.length - 1];
    if (
      (last?.ammoEntries ?? []).some(
        (entry) => (runtime.ammoSpent[entry.ammoType] ?? 0) > 0,
      )
    ) {
      setBuild((previous) => ({
        ...previous,
        equipment: (last?.ammoEntries ?? []).reduce(
          (equipment, entry) =>
            restoreAmmoToEquipment(
              equipment,
              entry.ammoType,
              entry.amount,
              previous.campaignRules,
            ),
          previous.equipment ?? [],
        ),
      }));
    }
    runtime.undoWeaponAttack(weaponKey, weaponName);
  }

  function resetWeaponAttackHistory(weaponKey?: string, weaponName?: string) {
    setBuild((previous) => ({
      ...previous,
      equipment: restoreAttackHistoryAmmo(
        previous.equipment,
        runtime.weaponAttackHistory,
        runtime.ammoSpent,
        weaponKey,
        previous.campaignRules,
      ),
    }));
    runtime.resetWeaponAttackHistory(weaponKey, weaponName);
  }

  function resetAmmo(ammoType?: string) {
    if (!ammoType?.trim()) {
      setBuild((previous) => ({
        ...previous,
        equipment: Object.entries(runtime.ammoSpent).reduce(
          (equipment, [type, amount]) =>
            restoreAmmoToEquipment(
              equipment,
              type,
              amount,
              previous.campaignRules,
            ),
          previous.equipment ?? [],
        ),
      }));
      runtime.resetAmmo();
      return;
    }
    const normalized = normalizeAmmoType(ammoType);
    const restoreAmount = runtime.ammoSpent[normalized] ?? 0;
    if (restoreAmount > 0) {
      setBuild((previous) => ({
        ...previous,
        equipment: restoreAmmoToEquipment(
          previous.equipment ?? [],
          normalized,
          restoreAmount,
          previous.campaignRules,
        ),
      }));
    }
    runtime.resetAmmo(normalized);
  }

  return {
    castSpell,
    recordWeaponAttack,
    resetAmmo,
    resetWeaponAttackHistory,
    setSheetWeaponLoadedAmmo,
    undoWeaponAttack,
  };
}
