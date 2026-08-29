import {
  normalizeAmmoType,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import { createAmmoStack } from "../equipmentTools";

type Equipment = NonNullable<CharacterBuild["equipment"]>;
type EquipmentItem = Equipment[number];
type EquipmentSlot = Exclude<EquipmentItem["slot"], undefined>;

function equipmentSlotLimit(slot: EquipmentSlot) {
  return slot === "ring" ? 2 : 1;
}

function defaultEquipmentState(entry: EquipmentItem) {
  if (entry.ownership === "wishlist" || entry.carryState === "cached") {
    return { equipped: false, carryState: "cached" as const };
  }
  const shouldEquip =
    entry.slot != null
      ? entry.slot !== "slotless"
      : !!entry.armor || !!entry.shield || !!entry.weapon;
  return {
    equipped: shouldEquip,
    carryState: "carried" as const,
  };
}

export function withDefaultEquipmentState(entry: EquipmentItem) {
  return {
    ...defaultEquipmentState(entry),
    ownership: "owned" as const,
    ...entry,
  };
}

function isGenericUnspecializedEquipment(entry: EquipmentItem) {
  return (
    !entry.itemTemplateId &&
    entry.slot == null &&
    !entry.armor &&
    !entry.shield &&
    !entry.weapon &&
    !entry.modifiers?.length
  );
}

export function applyTemplateEquipmentState(
  previous: EquipmentItem,
  next: EquipmentItem,
) {
  return isGenericUnspecializedEquipment(previous)
    ? { ...next, ...defaultEquipmentState(next) }
    : next;
}

export function sanitizeEquippedEquipment(
  equipment: Equipment,
  priorityIndex?: number,
) {
  const slotUsage = new Map<EquipmentSlot, number[]>();
  const armorIndexes: number[] = [];
  const shieldIndexes: number[] = [];

  equipment.forEach((item, index) => {
    if (!item.equipped || item.carryState === "cached") return;
    if (item.slot) {
      const current = slotUsage.get(item.slot) ?? [];
      current.push(index);
      slotUsage.set(item.slot, current);
    }
    if (item.armor) armorIndexes.push(index);
    if (item.shield) shieldIndexes.push(index);
  });

  const indexesToUnequip = new Set<number>();
  const trimIndexes = (indexes: number[], limit: number) => {
    if (indexes.length <= limit) return;
    const prioritized =
      priorityIndex != null && indexes.includes(priorityIndex)
        ? [priorityIndex, ...indexes.filter((index) => index !== priorityIndex)]
        : indexes;
    prioritized.slice(limit).forEach((index) => indexesToUnequip.add(index));
  };

  for (const [slot, indexes] of slotUsage.entries()) {
    trimIndexes(indexes, equipmentSlotLimit(slot));
  }
  trimIndexes(armorIndexes, 1);
  trimIndexes(shieldIndexes, 1);

  return equipment.map((item, index) => {
    const forcedUnequipped =
      indexesToUnequip.has(index) || item.carryState === "cached";
    return forcedUnequipped ? { ...item, equipped: false } : item;
  });
}

export function withAmmoAutofill(
  build: CharacterBuild,
  ammoType: string | undefined,
) {
  if (!ammoType?.trim()) return build;
  const normalized = normalizeAmmoType(ammoType);
  const hasAmmoStack = (build.equipment ?? []).some(
    (item) => normalizeAmmoType(item.ammoType ?? item.name) === normalized,
  );
  if (hasAmmoStack) return build;
  return {
    ...build,
    equipment: [...(build.equipment ?? []), createAmmoStack(normalized)],
  };
}
