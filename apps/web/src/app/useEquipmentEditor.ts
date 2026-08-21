import type { Dispatch, SetStateAction } from "react";
import {
  equipmentWeaponTemplate,
  type CharacterBuild,
  type MagicItemDefinition,
  type WeaponDefinition,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARMOR,
  RUNTIME_MAGIC_ITEMS,
  RUNTIME_MUNDANE_EQUIPMENT,
  equipmentMagicItemTemplate,
  getRuntimeMagicItem,
  type RuntimeArmorDefinition,
  type RuntimeMundaneEquipmentDefinition,
} from "../content";
import {
  applyTemplateEquipmentState,
  sanitizeEquippedEquipment,
  withAmmoAutofill,
  withDefaultEquipmentState,
} from "./equipmentState";

type Equipment = NonNullable<CharacterBuild["equipment"]>;
type EquipmentItem = Equipment[number];

interface EquipmentArmorEditorState {
  category: "none" | "light" | "medium" | "heavy";
  acBonus?: number;
  maxDexBonus?: number;
  checkPenalty?: number;
  speedPenalty?: number;
}

interface EquipmentShieldEditorState {
  enabled: boolean;
  acBonus?: number;
  checkPenalty?: number;
}

export function useEquipmentEditor(
  build: CharacterBuild,
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
  weaponOptions: WeaponDefinition[],
) {
  function addEquipmentEntry(entry: EquipmentItem) {
    setBuild((previous) => ({
      ...previous,
      equipment: [
        withDefaultEquipmentState(entry),
        ...(previous.equipment ?? []),
      ],
    }));
  }

  function addEquipment() {
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: undefined,
      name: "New Item",
      quantity: 1,
      weight: 0,
      costGp: 0,
    });
  }

  function addMagicItem() {
    addEquipmentEntry({
      kind: "magic",
      itemTemplateId: undefined,
      name: "New Magic Item",
      quantity: 1,
      weight: 0,
      costGp: 0,
    });
  }

  function applyMagicItemDefinition(index: number, item: MagicItemDefinition) {
    const template = equipmentMagicItemTemplate(item);
    setBuild((previous) => {
      const nextEquipment: Equipment = (previous.equipment ?? []).map(
        (entry, itemIndex) => {
          if (itemIndex !== index) return entry;
          const nextEntry: EquipmentItem = {
            ...entry,
            kind: "magic",
            carryState:
              entry.carryState ?? (entry.equipped ? "carried" : "stowed"),
            itemTemplateId: template.itemTemplateId,
            name: template.name,
            weight: template.weight,
            costGp: template.costGp,
            slot: template.slot,
            modifiers: template.modifiers,
            armor: undefined,
            shield: undefined,
            weapon: undefined,
          };
          return applyTemplateEquipmentState(entry, nextEntry);
        },
      );
      return {
        ...previous,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function applyMagicItemTemplate(index: number, itemId: string) {
    const item = RUNTIME_MAGIC_ITEMS.find((option) => option.id === itemId);
    if (item) applyMagicItemDefinition(index, item);
  }

  function applyEquipmentCatalogTemplate(
    index: number,
    item: RuntimeMundaneEquipmentDefinition | RuntimeArmorDefinition,
  ) {
    setBuild((previous) => {
      const nextEquipment: Equipment = (previous.equipment ?? []).map(
        (entry, itemIndex) => {
          if (itemIndex !== index) return entry;
          const nextEntry: EquipmentItem =
            "categoryNormalized" in item
              ? item.categoryNormalized === "shield"
                ? {
                    ...entry,
                    kind: "mundane",
                    carryState:
                      entry.carryState ??
                      (entry.equipped ? "carried" : "stowed"),
                    itemTemplateId: item.id,
                    name: item.name,
                    weight: item.weightLb,
                    costGp: item.costGp,
                    slot: "shield",
                    modifiers: item.modifiers,
                    armor: undefined,
                    shield: {
                      acBonus: item.armorBonus,
                      checkPenalty:
                        item.armorCheckPenalty === undefined
                          ? undefined
                          : Math.abs(item.armorCheckPenalty),
                      rangedTouchShieldFraction: item.rangedTouchShieldFraction,
                    },
                    weapon: undefined,
                  }
                : {
                    ...entry,
                    kind: "mundane",
                    itemTemplateId: item.id,
                    name: item.name,
                    weight: item.weightLb,
                    costGp: item.costGp,
                    slot: "armor",
                    modifiers: item.modifiers,
                    armor: item.categoryNormalized
                      ? {
                          category: item.categoryNormalized,
                          acBonus: item.armorBonus,
                          maxDexBonus: item.maxDexBonus,
                          checkPenalty:
                            item.armorCheckPenalty === undefined
                              ? undefined
                              : Math.abs(item.armorCheckPenalty),
                          speedPenalty:
                            typeof item.speed30 === "number" &&
                            typeof item.speed20 === "number"
                              ? item.speed30 - item.speed20
                              : undefined,
                          rangedTouchArmorFraction:
                            item.rangedTouchArmorFraction,
                        }
                      : undefined,
                    shield: undefined,
                    weapon: undefined,
                  }
              : {
                  ...entry,
                  kind: "mundane",
                  itemTemplateId: item.id,
                  name: item.name,
                  weight: item.weightLb,
                  costGp: item.costGp,
                  slot: undefined,
                  modifiers: undefined,
                  armor: undefined,
                  shield: undefined,
                  weapon: undefined,
                };
          return applyTemplateEquipmentState(entry, nextEntry);
        },
      );
      return {
        ...previous,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function applyMundaneEquipmentTemplate(index: number, itemId: string) {
    const item = RUNTIME_MUNDANE_EQUIPMENT.find(
      (option) => option.id === itemId,
    );
    if (item) applyEquipmentCatalogTemplate(index, item);
  }

  function addMagicItemFromTemplate(itemId: string) {
    const item = RUNTIME_MAGIC_ITEMS.find((option) => option.id === itemId);
    if (!item) return;
    const template = equipmentMagicItemTemplate(item);
    addEquipmentEntry({
      kind: "magic",
      itemTemplateId: template.itemTemplateId,
      name: template.name,
      quantity: 1,
      weight: template.weight,
      costGp: template.costGp,
      slot: template.slot,
      modifiers: template.modifiers,
    });
  }

  function addEquipmentFromTemplate(itemId: string) {
    const item = RUNTIME_MUNDANE_EQUIPMENT.find(
      (option) => option.id === itemId,
    );
    if (!item) return;
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: item.id,
      name: item.name,
      quantity: 1,
      weight: item.weightLb,
      costGp: item.costGp,
    });
  }

  function addArmorFromTemplate(itemId: string) {
    const item = RUNTIME_ARMOR.find(
      (option) =>
        option.id === itemId && option.categoryNormalized !== "shield",
    );
    if (!item) return;
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: item.id,
      name: item.name,
      quantity: 1,
      weight: item.weightLb,
      costGp: item.costGp,
      slot: "armor",
      modifiers: item.modifiers,
      armor:
        item.categoryNormalized && item.categoryNormalized !== "shield"
          ? {
              category: item.categoryNormalized,
              acBonus: item.armorBonus,
              maxDexBonus: item.maxDexBonus,
              checkPenalty:
                item.armorCheckPenalty === undefined
                  ? undefined
                  : Math.abs(item.armorCheckPenalty),
              speedPenalty:
                typeof item.speed30 === "number" &&
                typeof item.speed20 === "number"
                  ? item.speed30 - item.speed20
                  : undefined,
              rangedTouchArmorFraction: item.rangedTouchArmorFraction,
            }
          : undefined,
    });
  }

  function addShieldFromTemplate(itemId: string) {
    const item = RUNTIME_ARMOR.find(
      (option) =>
        option.id === itemId && option.categoryNormalized === "shield",
    );
    if (!item) return;
    addEquipmentEntry({
      kind: "mundane",
      itemTemplateId: item.id,
      name: item.name,
      quantity: 1,
      weight: item.weightLb,
      costGp: item.costGp,
      slot: "shield",
      modifiers: item.modifiers,
      shield: {
        acBonus: item.armorBonus,
        checkPenalty:
          item.armorCheckPenalty === undefined
            ? undefined
            : Math.abs(item.armorCheckPenalty),
        rangedTouchShieldFraction: item.rangedTouchShieldFraction,
      },
    });
  }

  function applyArmorTemplate(index: number, itemId: string) {
    const item = RUNTIME_ARMOR.find(
      (option) =>
        option.id === itemId && option.categoryNormalized !== "shield",
    );
    if (item) applyEquipmentCatalogTemplate(index, item);
  }

  function applyShieldTemplate(index: number, itemId: string) {
    const item = RUNTIME_ARMOR.find(
      (option) =>
        option.id === itemId && option.categoryNormalized === "shield",
    );
    if (item) applyEquipmentCatalogTemplate(index, item);
  }

  function stepMagicItemTier(index: number, delta: -1 | 1) {
    const currentId = build.equipment?.[index]?.itemTemplateId;
    const current = currentId ? getRuntimeMagicItem(currentId) : undefined;
    const nextId = delta > 0 ? current?.upgradeToId : current?.downgradeToId;
    const next = nextId ? getRuntimeMagicItem(nextId) : undefined;
    if (next) applyMagicItemDefinition(index, next);
  }

  function updateEquipment(index: number, patch: Partial<EquipmentItem>) {
    setBuild((previous) => {
      const nextEquipment: Equipment = (previous.equipment ?? []).map(
        (item, itemIndex) => {
          if (itemIndex !== index) return item;
          const nextItem = { ...item, ...patch };
          if (
            patch.equipped === true &&
            patch.carryState == null &&
            nextItem.carryState !== "carried"
          )
            nextItem.carryState = "carried";
          if (patch.carryState === "cached") nextItem.equipped = false;
          if (patch.ownership === "wishlist") {
            nextItem.equipped = false;
            nextItem.carryState = "cached";
          }
          if (patch.ownership === "owned" && nextItem.carryState === "cached")
            nextItem.carryState = "stowed";
          return nextItem;
        },
      );
      const nextBuild = {
        ...previous,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          patch.equipped ? index : undefined,
        ),
      };
      return withAmmoAutofill(nextBuild, patch.ammoType);
    });
  }

  function updateEquipmentShield(
    index: number,
    patch: EquipmentShieldEditorState,
  ) {
    setBuild((previous) => {
      const nextEquipment: Equipment = (previous.equipment ?? []).map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                slot: patch.enabled
                  ? (item.slot ?? "shield")
                  : item.slot === "shield"
                    ? undefined
                    : item.slot,
                shield: patch.enabled
                  ? {
                      acBonus: patch.acBonus,
                      checkPenalty: patch.checkPenalty,
                    }
                  : undefined,
              }
            : item,
      );
      return {
        ...previous,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function updateEquipmentWeapon(
    index: number,
    patch: NonNullable<EquipmentItem["weapon"]> & { enabled?: boolean },
  ) {
    setBuild((previous) => {
      const nextBuild = {
        ...previous,
        equipment: (previous.equipment ?? []).map((item, itemIndex) => {
          if (itemIndex !== index) return item;
          if (patch.enabled === false) return { ...item, weapon: undefined };
          const { enabled: _enabled, ...weapon } = patch;
          return { ...item, weapon };
        }),
      };
      return withAmmoAutofill(nextBuild, patch.ammoType);
    });
  }

  function applyEquipmentWeaponTemplate(index: number, weaponId: string) {
    const template = weaponOptions.find((weapon) => weapon.id === weaponId);
    if (!template) return;
    const equipmentTemplate = equipmentWeaponTemplate(template);
    setBuild((previous) => {
      const nextBuild = {
        ...previous,
        equipment: (previous.equipment ?? []).map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                name: equipmentTemplate.name,
                weight: equipmentTemplate.weight,
                costGp: equipmentTemplate.costGp,
                weapon: equipmentTemplate.weapon,
              }
            : item,
        ),
      };
      return withAmmoAutofill(nextBuild, equipmentTemplate.weapon.ammoType);
    });
  }

  function updateEquipmentArmor(
    index: number,
    patch: EquipmentArmorEditorState,
  ) {
    setBuild((previous) => {
      const nextEquipment: Equipment = (previous.equipment ?? []).map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                slot:
                  patch.category === "none"
                    ? item.slot === "armor"
                      ? undefined
                      : item.slot
                    : (item.slot ?? "armor"),
                armor:
                  patch.category === "none"
                    ? undefined
                    : {
                        category: patch.category,
                        acBonus: patch.acBonus,
                        maxDexBonus: patch.maxDexBonus,
                        checkPenalty: patch.checkPenalty,
                        speedPenalty: patch.speedPenalty,
                      },
              }
            : item,
      );
      return {
        ...previous,
        equipment: sanitizeEquippedEquipment(
          nextEquipment,
          nextEquipment[index]?.equipped ? index : undefined,
        ),
      };
    });
  }

  function removeEquipment(index: number) {
    setBuild((previous) => ({
      ...previous,
      equipment: (previous.equipment ?? []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  return {
    addArmorFromTemplate,
    addEquipment,
    addEquipmentFromTemplate,
    addMagicItem,
    addMagicItemFromTemplate,
    addShieldFromTemplate,
    applyArmorTemplate,
    applyEquipmentWeaponTemplate,
    applyMagicItemTemplate,
    applyMundaneEquipmentTemplate,
    applyShieldTemplate,
    removeEquipment,
    stepMagicItemTier,
    updateEquipment,
    updateEquipmentArmor,
    updateEquipmentShield,
    updateEquipmentWeapon,
  };
}
