import { normalizeAmmoType, type WeaponDefinition } from "@mathfinder/rules-engine";

export type WeaponAvailabilityFilter = "all" | "early" | "advanced" | "ordnance";

type WeaponLike = Pick<
  WeaponDefinition,
  "ammoType" | "specialTags" | "weaponTechnology"
> & {
  name?: string;
};

export function weaponAvailabilityMatches(
  weapon: WeaponLike,
  filter: WeaponAvailabilityFilter,
) {
  if (filter === "all") return true;
  if (filter === "ordnance") return weaponIsOrdnance(weapon);
  return weapon.weaponTechnology === filter;
}

export function weaponIsOrdnance(weapon: WeaponLike) {
  const ammoType = normalizeAmmoType(weapon.ammoType ?? "");
  const tags = new Set((weapon.specialTags ?? []).map((tag) => tag.toLowerCase()));
  return (
    tags.has("grenade") ||
    tags.has("explosive") ||
    tags.has("siege") ||
    tags.has("launcher") ||
    tags.has("rocket") ||
    ammoType.includes("grenade") ||
    ammoType.includes("mortar") ||
    ammoType.includes("rocket")
  );
}

export function weaponAmmoUxLabel(weapon: WeaponLike) {
  const ammoType = normalizeAmmoType(weapon.ammoType ?? "");
  if (!ammoType) return undefined;
  if (ammoType === "grenade sabot") return "Load grenade + sabot";
  if (ammoType === "mortar shell") return "Choose a mortar shell payload";
  if (ammoType === "ap mortar shell" || ammoType === "incendiary mortar shell") {
    return "Mortar shell payload";
  }
  if (ammoType === "law of fire rocket" || ammoType === "rpgl rocket") {
    return "Single-use rocket payload";
  }
  if (ammoType === "common tranq round" || ammoType === "rare tranq round") {
    return "Special tranq payload";
  }
  if (ammoType === "belted rifle round" || ammoType === "belted large caliber round") {
    return "Belt-fed ammunition";
  }
  if (ammoType === "shotgun shell") return "Pellets or slugs";
  return undefined;
}
