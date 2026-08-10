import type { CharacterBuild, Weapon } from "@mathfinder/rules-engine";
import { ammoCatalogEntry } from "./ammoCatalog";

type EmbeddedWeapon = NonNullable<
  NonNullable<CharacterBuild["equipment"]>[number]["weapon"]
>;

function mergeUnique(values: Array<string[] | undefined>) {
  return [...new Set(values.flatMap((entry) => entry ?? []).filter(Boolean))];
}

function ammoConsumptionsForWeapon(weapon: Weapon) {
  const baseAmmoType = weapon.ammoType?.trim();
  const selectedAmmoType = weapon.loadedAmmoType?.trim();
  if (!baseAmmoType && !selectedAmmoType) return undefined;
  if (!selectedAmmoType || selectedAmmoType === baseAmmoType) {
    return baseAmmoType
      ? [{ ammoType: baseAmmoType, amount: weapon.ammoPerAttack ?? 1 }]
      : undefined;
  }
  const amount = weapon.ammoPerAttack ?? 1;
  const selectedAmmo = ammoCatalogEntry(selectedAmmoType);
  if (selectedAmmo?.consumeWithBase && baseAmmoType) {
    return [
      { ammoType: baseAmmoType, amount },
      { ammoType: selectedAmmoType, amount },
    ];
  }
  return [{ ammoType: selectedAmmoType, amount }];
}

function applyLoadedAmmo(weapon: Weapon): Weapon {
  const selectedAmmoType = weapon.loadedAmmoType?.trim();
  const ammoConsumptions = ammoConsumptionsForWeapon(weapon);
  if (!selectedAmmoType) return { ...weapon, ammoConsumptions };
  const ammo = ammoCatalogEntry(selectedAmmoType);
  if (!ammo) return { ...weapon, ammoConsumptions };
  return {
    ...weapon,
    ammoConsumptions,
    attackModifier: (weapon.attackModifier ?? 0) + (ammo.attackModifier ?? 0),
    rangeIncrementFeet:
      typeof weapon.rangeIncrementFeet === "number"
        ? weapon.rangeIncrementFeet + (ammo.rangeIncrementBonusFeet ?? 0)
        : weapon.rangeIncrementFeet,
    extraDamageDice: mergeUnique([
      weapon.extraDamageDice,
      ammo.extraDamageDice,
    ]),
    ammoNotes: mergeUnique([weapon.ammoNotes, ammo.notes]),
    ordnanceProfile: ammo.ordnanceProfile ?? weapon.ordnanceProfile,
  };
}

function applyWeaponLoadout(weapon: EmbeddedWeapon | undefined) {
  if (!weapon) return weapon;
  return applyLoadedAmmo({ ...weapon, name: "embedded-weapon" });
}

export function applyWeaponLoadoutsToBuild(
  build: CharacterBuild,
): CharacterBuild {
  return {
    ...build,
    weapons: build.weapons?.map((weapon) => applyLoadedAmmo(weapon)),
    equipment: build.equipment?.map((item) => ({
      ...item,
      weapon: (() => {
        const loaded = applyWeaponLoadout(item.weapon);
        if (!loaded) return loaded;
        const { name: _ignoredName, ...embedded } = loaded;
        return embedded;
      })(),
    })),
  };
}
