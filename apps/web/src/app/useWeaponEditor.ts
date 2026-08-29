import type { Dispatch, SetStateAction } from "react";
import type {
  CharacterBuild,
  WeaponDefinition,
} from "@mathfinder/rules-engine";
import { withAmmoAutofill } from "./equipmentState";

type Weapon = NonNullable<CharacterBuild["weapons"]>[number];

const TEMPLATE_CONTROLLED_FIELDS: ReadonlyArray<keyof Weapon> = [
  "name",
  "category",
  "proficiencyGroup",
  "damageDice",
  "handedness",
  "critRange",
  "critMultiplier",
  "rangeIncrementFeet",
  "damageTypes",
  "specialTags",
  "ammoType",
  "loadedAmmoType",
  "ammoPerAttack",
  "reloadType",
  "firearmCategory",
  "weaponTechnology",
  "attackModifier",
  "extraDamageDice",
  "ammoNotes",
  "ordnanceProfile",
  "misfire",
  "targetsTouchAcWithinFirstRangeIncrement",
  "damageAbility",
];

export function useWeaponEditor(
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
  weaponOptions: WeaponDefinition[],
) {
  function addWeapon() {
    setBuild((previous) => ({
      ...previous,
      weapons: [
        ...(previous.weapons ?? []),
        {
          name: "New Weapon",
          weaponTemplateId: undefined,
          category: "melee",
          proficiencyGroup: "simple",
          damageDice: "1d6",
          handedness: "one",
          critMultiplier: 2,
          critRange: 20,
        },
      ],
    }));
  }

  function updateWeapon(index: number, patch: Partial<Weapon>) {
    setBuild((previous) => {
      const nextBuild = {
        ...previous,
        weapons: (previous.weapons ?? []).map((weapon, itemIndex) => {
          if (itemIndex !== index) return weapon;
          const next = { ...weapon, ...patch };
          const changedTemplateFields = TEMPLATE_CONTROLLED_FIELDS.some(
            (key) => key in patch,
          );
          if (changedTemplateFields && !("weaponTemplateId" in patch)) {
            next.weaponTemplateId = undefined;
          }
          return next;
        }),
      };
      return withAmmoAutofill(nextBuild, patch.ammoType);
    });
  }

  function applyWeaponTemplate(index: number, weaponId: string) {
    const template = weaponOptions.find((weapon) => weapon.id === weaponId);
    if (!template) return;
    updateWeapon(index, {
      weaponTemplateId: template.id,
      name: template.name,
      category: template.category,
      proficiencyGroup: template.proficiencyGroup,
      damageDice: template.damageDice,
      handedness: template.handedness,
      critRange: template.critRange,
      critMultiplier: template.critMultiplier,
      rangeIncrementFeet: template.rangeIncrementFeet,
      damageTypes: template.damageTypes,
      specialTags: template.specialTags,
      ammoType: template.ammoType,
      loadedAmmoType: undefined,
      ammoPerAttack: template.ammoPerAttack,
      reloadType: template.reloadType,
      firearmCategory: template.firearmCategory,
      weaponTechnology: template.weaponTechnology,
      attackModifier: template.attackModifier,
      extraDamageDice: template.extraDamageDice,
      ammoNotes: template.ammoNotes,
      ordnanceProfile: template.ordnanceProfile,
      misfire: template.misfire,
      targetsTouchAcWithinFirstRangeIncrement:
        template.targetsTouchAcWithinFirstRangeIncrement,
      damageAbility: template.damageAbility,
    });
  }

  function removeWeapon(index: number) {
    setBuild((previous) => ({
      ...previous,
      weapons: (previous.weapons ?? []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  return { addWeapon, applyWeaponTemplate, removeWeapon, updateWeapon };
}
