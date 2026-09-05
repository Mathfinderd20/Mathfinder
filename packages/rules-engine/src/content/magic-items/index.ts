import {
  buildCompendiumIndex,
  getCompendiumEntryById,
  getCompendiumEntryByName,
} from "../../compendium";
import type { EquipmentMagicItemTemplate, MagicItemDefinition } from "./shared";
import { BODY_ITEMS } from "./slot-body";
import { CHEST_ITEMS } from "./slot-chest";
import { BELT_ITEMS } from "./slot-belt";
import { EYES_ITEMS } from "./slot-eyes";
import { FEET_ITEMS } from "./slot-feet";
import { HANDS_ITEMS } from "./slot-hands";
import { HEAD_ITEMS } from "./slot-head";
import { NECK_ITEMS } from "./slot-neck";
import { RING_ITEMS } from "./slot-ring";
import { SHOULDERS_ITEMS } from "./slot-shoulders";
import { TORSO_ITEMS } from "./slot-torso";
import { WRISTS_ITEMS } from "./slot-wrists";

export type {
  EquipmentMagicItemTemplate,
  MagicItemAutomationStatus,
  MagicItemDefinition,
  MagicItemSlot,
} from "./shared";

export const CORE_MAGIC_ITEMS: MagicItemDefinition[] = [
  ...HEAD_ITEMS,
  ...EYES_ITEMS,
  ...NECK_ITEMS,
  ...SHOULDERS_ITEMS,
  ...CHEST_ITEMS,
  ...BODY_ITEMS,
  ...TORSO_ITEMS,
  ...BELT_ITEMS,
  ...WRISTS_ITEMS,
  ...HANDS_ITEMS,
  ...FEET_ITEMS,
  ...RING_ITEMS,
];

export const MAGIC_ITEMS: MagicItemDefinition[] = [...CORE_MAGIC_ITEMS];

export const MAGIC_ITEM_INDEX = buildCompendiumIndex(MAGIC_ITEMS);

export const MAGIC_ITEMS_BY_ID: Record<string, MagicItemDefinition> =
  MAGIC_ITEM_INDEX.byId;

export function getMagicItem(id: string): MagicItemDefinition | undefined {
  return getCompendiumEntryById(MAGIC_ITEM_INDEX, id);
}

export function getMagicItemByName(
  name: string,
): MagicItemDefinition | undefined {
  return getCompendiumEntryByName(MAGIC_ITEM_INDEX, name);
}

export function equipmentMagicItemTemplate(
  item: MagicItemDefinition,
): EquipmentMagicItemTemplate {
  return {
    itemTemplateId: item.id,
    name: item.name,
    weight: item.weightLb,
    costGp: item.costGp,
    slot: item.slot,
    modifiers: item.modifiers,
  };
}
