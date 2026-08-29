import {
  normalizeAmmoType,
  type WeaponOrdnanceProfile,
} from "@mathfinder/rules-engine";

export interface AmmoCatalogEntry {
  ammoType: string;
  name: string;
  defaultQuantity: number;
  costGp: number;
  weightLb: number;
  compatibleBaseTypes?: string[];
  consumeWithBase?: boolean;
  attackModifier?: number;
  rangeIncrementBonusFeet?: number;
  extraDamageDice?: string[];
  notes?: string[];
  ordnanceProfile?: WeaponOrdnanceProfile;
}

const AMMO_CATALOG: AmmoCatalogEntry[] = [
  {
    ammoType: "arrow",
    name: "Arrows",
    defaultQuantity: 20,
    costGp: 1,
    weightLb: 3,
  },
  {
    ammoType: "bolt",
    name: "Bolts",
    defaultQuantity: 10,
    costGp: 1,
    weightLb: 1,
  },
  {
    ammoType: "bullet",
    name: "Bullets",
    defaultQuantity: 10,
    costGp: 100,
    weightLb: 1,
  },
  {
    ammoType: "handgun round",
    name: "Handgun Ammunition",
    defaultQuantity: 50,
    costGp: 500,
    weightLb: 5,
  },
  {
    ammoType: "rifle round",
    name: "Rifle Ammunition",
    defaultQuantity: 50,
    costGp: 750,
    weightLb: 8,
  },
  {
    ammoType: "belted rifle round",
    name: "Belted Rifle Ammunition",
    defaultQuantity: 50,
    costGp: 750.5,
    weightLb: 8,
  },
  {
    ammoType: "shotgun shell",
    name: "Shotgun Shells",
    defaultQuantity: 50,
    costGp: 750,
    weightLb: 8,
  },
  {
    ammoType: "large caliber round",
    name: "Large Caliber Ammunition",
    defaultQuantity: 50,
    costGp: 1500,
    weightLb: 12,
  },
  {
    ammoType: "belted large caliber round",
    name: "Belted Large Caliber Ammunition",
    defaultQuantity: 50,
    costGp: 1500.5,
    weightLb: 12,
  },
  {
    ammoType: "autocannon round",
    name: "Autocannon Ammunition",
    defaultQuantity: 10,
    costGp: 600,
    weightLb: 10,
  },
  {
    ammoType: "common tranq round",
    name: "Common Tranq Rounds",
    defaultQuantity: 5,
    costGp: 3000,
    weightLb: 1,
    compatibleBaseTypes: ["common tranq round"],
    notes: ["Fort DC 16 or unconscious for 1d4 minutes"],
  },
  {
    ammoType: "rare tranq round",
    name: "Rare Tranq Rounds",
    defaultQuantity: 5,
    costGp: 10000,
    weightLb: 1,
    compatibleBaseTypes: ["common tranq round"],
    notes: ["Fort DC 20 or unconscious for 1d4 minutes"],
  },
  {
    ammoType: "adamantine bullet",
    name: "Adamantine Bullets",
    defaultQuantity: 50,
    costGp: 3000,
    weightLb: 5,
    compatibleBaseTypes: [
      "handgun round",
      "rifle round",
      "large caliber round",
    ],
    notes: ["Ignore object hardness less than 20"],
  },
  {
    ammoType: "bleeding bullet",
    name: "Bleeding Bullets",
    defaultQuantity: 5,
    costGp: 1500,
    weightLb: 1,
    compatibleBaseTypes: [
      "handgun round",
      "rifle round",
      "large caliber round",
    ],
    notes: ["Hit causes bleed 1 until healed"],
  },
  {
    ammoType: "distance round",
    name: "Distance Rounds",
    defaultQuantity: 50,
    costGp: 2,
    weightLb: 5,
    compatibleBaseTypes: [
      "handgun round",
      "rifle round",
      "large caliber round",
    ],
    rangeIncrementBonusFeet: 10,
    notes: ["-1 damage per range increment, minimum 1"],
  },
  {
    ammoType: "flechette round",
    name: "Flechette Rounds",
    defaultQuantity: 50,
    costGp: 1250,
    weightLb: 5,
    compatibleBaseTypes: ["shotgun shell"],
    ordnanceProfile: { saveDc: 18, saveType: "ref", area: "5-ft burst" },
    extraDamageDice: ["1d4 piercing burst"],
    notes: ["Reflex negates burst splinters"],
  },
  {
    ammoType: "incendiary round",
    name: "Incendiary Rounds",
    defaultQuantity: 5,
    costGp: 500,
    weightLb: 1,
    compatibleBaseTypes: [
      "handgun round",
      "rifle round",
      "large caliber round",
      "shotgun shell",
    ],
    attackModifier: -1,
    extraDamageDice: ["1d6 fire"],
  },
  {
    ammoType: "rufuss red round",
    name: "Rufuss Red Rounds",
    defaultQuantity: 5,
    costGp: 2500,
    weightLb: 2,
    compatibleBaseTypes: ["large caliber round"],
    extraDamageDice: ["2d6 bludgeoning and piercing", "1d6 fire"],
    notes: ["DC 20 Reflex or catch fire"],
  },
  {
    ammoType: "spell disrupting round",
    name: "Spell Disrupting Rounds",
    defaultQuantity: 50,
    costGp: 750,
    weightLb: 5,
    compatibleBaseTypes: [
      "handgun round",
      "rifle round",
      "large caliber round",
      "arrow",
      "bolt",
    ],
    notes: [
      "Wounded target suffers 20% arcane spell failure until projectile removed",
    ],
  },
  {
    ammoType: "tracer round",
    name: "Tracer Rounds",
    defaultQuantity: 50,
    costGp: 25,
    weightLb: 5,
    compatibleBaseTypes: [
      "belted rifle round",
      "belted large caliber round",
      "rifle round",
      "large caliber round",
    ],
    notes: [
      "Automatic fire penalty reduced by 1 when at least 1 in 5 shots are tracers",
    ],
  },
  {
    ammoType: "grenade sabot",
    name: "Grenade Sabots",
    defaultQuantity: 5,
    costGp: 50,
    weightLb: 5,
  },
  {
    ammoType: "flashbang grenade",
    name: "Flashbang Grenades",
    defaultQuantity: 1,
    costGp: 350,
    weightLb: 3,
    compatibleBaseTypes: ["grenade sabot"],
    consumeWithBase: true,
    ordnanceProfile: {
      saveDc: 18,
      saveType: "ref",
      area: "10-ft radius",
      notes: ["Stunned 1d4 rounds"],
    },
  },
  {
    ammoType: "fragmentation grenade",
    name: "Fragmentation Grenades",
    defaultQuantity: 1,
    costGp: 350,
    weightLb: 3,
    compatibleBaseTypes: ["grenade sabot"],
    consumeWithBase: true,
    extraDamageDice: ["4d6 bludgeoning and piercing"],
    ordnanceProfile: {
      saveDc: 18,
      saveType: "ref",
      area: "5-ft radius",
      directHitEffect: "Direct target gets no initial save when launched",
    },
  },
  {
    ammoType: "gas grenade",
    name: "Gas Grenades",
    defaultQuantity: 1,
    costGp: 350,
    weightLb: 3,
    compatibleBaseTypes: ["grenade sabot"],
    consumeWithBase: true,
    ordnanceProfile: {
      saveDc: 18,
      saveType: "fort",
      area: "10-ft radius",
      duration: "1d6 rounds",
      notes: ["Fog cloud", "Breathers are sickened on failed Fort save"],
    },
  },
  {
    ammoType: "incendiary grenade",
    name: "Incendiary Grenades",
    defaultQuantity: 1,
    costGp: 350,
    weightLb: 3,
    compatibleBaseTypes: ["grenade sabot"],
    consumeWithBase: true,
    extraDamageDice: ["6d6 fire"],
    ordnanceProfile: {
      saveDc: 18,
      saveType: "ref",
      area: "5-ft square",
      duration: "1d6 rounds",
      directHitEffect: "Direct target gets no initial save when launched",
    },
  },
  {
    ammoType: "smoke grenade",
    name: "Smoke Grenades",
    defaultQuantity: 1,
    costGp: 350,
    weightLb: 3,
    compatibleBaseTypes: ["grenade sabot"],
    consumeWithBase: true,
    ordnanceProfile: {
      area: "10-ft radius",
      duration: "10 minutes",
      notes: ["Fog cloud"],
    },
  },
  {
    ammoType: "mortar shell",
    name: "Mortar Shells",
    defaultQuantity: 1,
    costGp: 3600,
    weightLb: 6,
  },
  {
    ammoType: "ap mortar shell",
    name: "AP Mortar Shells",
    defaultQuantity: 1,
    costGp: 3600,
    weightLb: 6,
    compatibleBaseTypes: ["mortar shell"],
    consumeWithBase: true,
    extraDamageDice: ["6d6 bludgeoning and piercing"],
    ordnanceProfile: { area: "30-ft radius" },
  },
  {
    ammoType: "incendiary mortar shell",
    name: "Incendiary Mortar Shells",
    defaultQuantity: 1,
    costGp: 3600,
    weightLb: 6,
    compatibleBaseTypes: ["mortar shell"],
    consumeWithBase: true,
    extraDamageDice: ["8d6 fire"],
    ordnanceProfile: { area: "20-ft radius" },
  },
  {
    ammoType: "law of fire rocket",
    name: "Law of Fire Rockets",
    defaultQuantity: 1,
    costGp: 1500,
    weightLb: 10,
    compatibleBaseTypes: ["law of fire rocket"],
    extraDamageDice: ["10d6 fire"],
    ordnanceProfile: { saveDc: 18, saveType: "ref", area: "20-ft burst" },
  },
  {
    ammoType: "rpgl rocket",
    name: "RPGL Rockets",
    defaultQuantity: 1,
    costGp: 3000,
    weightLb: 10,
    compatibleBaseTypes: ["rpgl rocket"],
    extraDamageDice: ["10d6 electricity"],
    ordnanceProfile: { saveDc: 18, saveType: "ref", area: "120-ft line" },
  },
];

const AMMO_BY_TYPE = new Map(
  AMMO_CATALOG.map(
    (entry) => [normalizeAmmoType(entry.ammoType), entry] as const,
  ),
);

export const AMMO_CATALOG_ENTRIES = [...AMMO_CATALOG];

export function ammoCatalogEntry(ammoType: string) {
  return AMMO_BY_TYPE.get(normalizeAmmoType(ammoType));
}

export function compatibleAmmoEntries(baseAmmoType: string | undefined) {
  const normalizedBase = normalizeAmmoType(baseAmmoType ?? "");
  if (!normalizedBase) return [];
  return AMMO_CATALOG.filter((entry) =>
    (entry.compatibleBaseTypes ?? []).some(
      (candidate) => normalizeAmmoType(candidate) === normalizedBase,
    ),
  );
}

export function ammoStackName(ammoType: string) {
  return ammoCatalogEntry(ammoType)?.name ?? fallbackAmmoName(ammoType);
}
export function defaultAmmoStackQuantity(ammoType: string) {
  return (
    ammoCatalogEntry(ammoType)?.defaultQuantity ??
    fallbackAmmoQuantity(ammoType)
  );
}
export function ammoStackCostGp(ammoType: string) {
  return ammoCatalogEntry(ammoType)?.costGp ?? 0;
}
export function ammoStackWeightLb(ammoType: string) {
  return ammoCatalogEntry(ammoType)?.weightLb ?? 0;
}

function fallbackAmmoName(ammoType: string) {
  const normalized = normalizeAmmoType(ammoType);
  return (
    normalized
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") + "s"
  );
}
function fallbackAmmoQuantity(ammoType: string) {
  const normalized = normalizeAmmoType(ammoType);
  return normalized === "bullet" ? 10 : 20;
}
