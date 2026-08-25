import {
  normalizeAmmoType,
  type CampaignRules,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import {
  ammoStackCostGp,
  ammoStackName as ammoCatalogStackName,
  ammoStackWeightLb,
  defaultAmmoStackQuantity as ammoCatalogDefaultQuantity,
} from "./ammoCatalog";

export type EquipmentItem = NonNullable<CharacterBuild["equipment"]>[number];
export type CarryState = NonNullable<EquipmentItem["carryState"]>;
export type OwnershipState = NonNullable<EquipmentItem["ownership"]>;
export type GearSortMode =
  "manual" | "name" | "weight" | "cost" | "quantity" | "equipped";
export type GearGroupMode =
  "none" | "carry-state" | "slot" | "usage" | "container";
export type EquipmentUsePresetId =
  | "wand"
  | "potion"
  | "scroll"
  | "staff"
  | "charged"
  | "arrows"
  | "bolts"
  | "bullets"
  | "handgun-ammo"
  | "rifle-ammo"
  | "belted-rifle-ammo"
  | "shotgun-shells"
  | "large-caliber-ammo"
  | "belted-large-caliber-ammo"
  | "common-tranq-rounds"
  | "adamantine-bullets"
  | "bleeding-bullets"
  | "distance-rounds"
  | "flechette-rounds"
  | "incendiary-rounds"
  | "rufuss-red-rounds"
  | "spell-disrupting-rounds"
  | "tracer-rounds"
  | "rare-tranq-rounds"
  | "grenade-sabots"
  | "ap-mortar-shell"
  | "incendiary-mortar-shell"
  | "law-of-fire-rocket"
  | "rpgl-rocket";
export type EquipmentComponentPresetId =
  "component-pouch" | "arcane-focus" | "holy-symbol" | "spellbook" | "kit";

export interface EquipmentUsePreset {
  id: EquipmentUsePresetId;
  label: string;
  patch: Partial<EquipmentItem>;
}

export interface EquipmentComponentPreset {
  id: EquipmentComponentPresetId;
  label: string;
  patch: Partial<EquipmentItem>;
}

function ammoPreset(
  id: EquipmentUsePresetId,
  label: string,
  ammoType: string,
): EquipmentUsePreset {
  const stack = createAmmoStack(ammoType);
  return { id, label, patch: stack };
}

export const EQUIPMENT_USE_PRESETS: EquipmentUsePreset[] = [
  {
    id: "wand",
    label: "Wand 50",
    patch: { usesRemaining: 50, usesMax: 50, quantity: 1 },
  },
  {
    id: "staff",
    label: "Staff 10",
    patch: { usesRemaining: 10, usesMax: 10, quantity: 1 },
  },
  {
    id: "charged",
    label: "Charged 3",
    patch: { usesRemaining: 3, usesMax: 3, quantity: 1 },
  },
  {
    id: "potion",
    label: "Potion 1",
    patch: { usesRemaining: 1, usesMax: 1, quantity: 1 },
  },
  {
    id: "scroll",
    label: "Scroll 1",
    patch: { usesRemaining: 1, usesMax: 1, quantity: 1 },
  },
  ammoPreset("arrows", "Arrows 20", "arrow"),
  ammoPreset("bolts", "Bolts 10", "bolt"),
  ammoPreset("bullets", "Bullets 10", "bullet"),
  ammoPreset("handgun-ammo", "Handgun Ammo 50", "handgun round"),
  ammoPreset("rifle-ammo", "Rifle Ammo 50", "rifle round"),
  ammoPreset("belted-rifle-ammo", "Belted Rifle 50", "belted rifle round"),
  ammoPreset("shotgun-shells", "Shells 50", "shotgun shell"),
  ammoPreset("large-caliber-ammo", "Large Cal 50", "large caliber round"),
  ammoPreset(
    "belted-large-caliber-ammo",
    "Belted Large Cal 50",
    "belted large caliber round",
  ),
  ammoPreset("common-tranq-rounds", "Tranq 5", "common tranq round"),
  ammoPreset("adamantine-bullets", "Adamantine 50", "adamantine bullet"),
  ammoPreset("bleeding-bullets", "Bleeding 5", "bleeding bullet"),
  ammoPreset("distance-rounds", "Distance 50", "distance round"),
  ammoPreset("flechette-rounds", "Flechette 50", "flechette round"),
  ammoPreset("incendiary-rounds", "Incendiary 5", "incendiary round"),
  ammoPreset("rufuss-red-rounds", "Rufuss Red 5", "rufuss red round"),
  ammoPreset(
    "spell-disrupting-rounds",
    "Spell Disrupt 50",
    "spell disrupting round",
  ),
  ammoPreset("tracer-rounds", "Tracer 50", "tracer round"),
  ammoPreset("rare-tranq-rounds", "Rare Tranq 5", "rare tranq round"),
  ammoPreset("grenade-sabots", "Sabots 5", "grenade sabot"),
  ammoPreset("ap-mortar-shell", "AP Mortar", "ap mortar shell"),
  ammoPreset(
    "incendiary-mortar-shell",
    "Incendiary Mortar",
    "incendiary mortar shell",
  ),
  ammoPreset("law-of-fire-rocket", "Law of Fire", "law of fire rocket"),
  ammoPreset("rpgl-rocket", "RPGL Rocket", "rpgl rocket"),
];

export function defaultCarryState(item: EquipmentItem): CarryState {
  return item.carryState ?? (item.equipped ? "carried" : "stowed");
}

export function defaultOwnership(item: EquipmentItem): OwnershipState {
  return item.ownership ?? "owned";
}

export function equipmentCountsTowardWeight(item: EquipmentItem) {
  return (
    defaultOwnership(item) === "owned" && defaultCarryState(item) !== "cached"
  );
}

export function equipmentIsOwned(item: EquipmentItem) {
  return defaultOwnership(item) === "owned";
}

export function displayCarryState(carryState: CarryState) {
  return carryState === "cached" ? "cached" : carryState;
}

export function displayOwnership(ownership: OwnershipState) {
  return ownership === "wishlist" ? "wishlist" : "owned";
}

export const EQUIPMENT_COMPONENT_PRESETS: EquipmentComponentPreset[] = [
  {
    id: "component-pouch",
    label: "Component Pouch",
    patch: { componentCategory: "material", quantity: 1 },
  },
  {
    id: "arcane-focus",
    label: "Arcane Focus",
    patch: { componentCategory: "focus", quantity: 1 },
  },
  {
    id: "holy-symbol",
    label: "Holy Symbol",
    patch: { componentCategory: "divine-focus", quantity: 1 },
  },
  {
    id: "spellbook",
    label: "Spellbook",
    patch: { componentCategory: "spellbook", quantity: 1 },
  },
  {
    id: "kit",
    label: "Kit",
    patch: { componentCategory: "kit", quantity: 1 },
  },
];

export function applyEquipmentUsePreset(
  item: EquipmentItem,
  presetId: EquipmentUsePresetId,
  campaignRules?: CampaignRules | null,
): Partial<EquipmentItem> {
  const preset = EQUIPMENT_USE_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return {};
  const ammoPatch = preset.patch.ammoType
    ? createAmmoStack(preset.patch.ammoType, campaignRules)
    : undefined;
  return { ...item, ...preset.patch, ...ammoPatch };
}

export function applyEquipmentComponentPreset(
  item: EquipmentItem,
  presetId: EquipmentComponentPresetId,
): Partial<EquipmentItem> {
  const preset = EQUIPMENT_COMPONENT_PRESETS.find(
    (entry) => entry.id === presetId,
  );
  if (!preset) return {};
  return { ...item, ...preset.patch };
}

export function defaultAmmoStackQuantity(ammoType: string) {
  return ammoCatalogDefaultQuantity(ammoType);
}

export function ammoStackName(ammoType: string) {
  return ammoCatalogStackName(ammoType);
}

export function createAmmoStack(
  ammoType: string,
  campaignRules?: CampaignRules | null,
): EquipmentItem {
  const normalized = normalizeAmmoType(ammoType);
  return {
    kind: "mundane",
    name: ammoStackName(normalized),
    quantity: defaultAmmoStackQuantity(normalized),
    weight: ammoStackWeightLb(normalized),
    costGp: ammoStackCostGp(normalized, campaignRules),
    equipped: false,
    carryState: "stowed",
    ammoType: normalized,
  };
}

export function summarizeAmmoStacks(equipment: EquipmentItem[]) {
  const totals = new Map<string, number>();
  for (const item of equipment.filter(equipmentIsOwned)) {
    const ammoType = item.ammoType?.trim();
    if (!ammoType) continue;
    const key = normalizeAmmoType(ammoType);
    totals.set(key, (totals.get(key) ?? 0) + (item.quantity ?? 1));
  }
  return [...totals.entries()].map(([ammoType, quantity]) => ({
    ammoType,
    quantity,
  }));
}

export function summarizeConsumables(equipment: EquipmentItem[]) {
  return equipment
    .filter(equipmentIsOwned)
    .filter(
      (item) =>
        typeof item.usesMax === "number" ||
        typeof item.usesRemaining === "number",
    )
    .map((item) => ({
      name: item.name,
      usesRemaining: item.usesRemaining ?? 0,
      usesMax: item.usesMax ?? 0,
    }));
}

export function summarizeWeaponAmmoCoverage(
  build: CharacterBuild,
  equipment: EquipmentItem[],
) {
  const ammoTotals = new Map(
    summarizeAmmoStacks(equipment).map(
      ({ ammoType, quantity }) => [ammoType, quantity] as const,
    ),
  );
  const weapons = [
    ...(build.weapons ?? []).map((weapon) => ({
      name: weapon.name,
      ammoType: weapon.ammoType,
    })),
    ...equipment
      .filter((item) => equipmentIsOwned(item) && item.equipped && item.weapon)
      .map((item) => ({ name: item.name, ammoType: item.weapon?.ammoType })),
  ].filter((weapon) => weapon.ammoType?.trim());
  const covered: Array<{
    weaponName: string;
    ammoType: string;
    quantity: number;
  }> = [];
  const missing: string[] = [];
  for (const weapon of weapons) {
    const ammoType = normalizeAmmoType(weapon.ammoType!);
    const quantity = ammoTotals.get(ammoType) ?? 0;
    if (quantity > 0)
      covered.push({ weaponName: weapon.name, ammoType, quantity });
    else missing.push(`${weapon.name} has no tracked ${ammoType} ammo stack`);
  }
  return { covered, missing };
}

export function summarizeComponents(equipment: EquipmentItem[]) {
  const totals = new Map<string, number>();
  for (const item of equipment.filter(equipmentIsOwned)) {
    const category = item.componentCategory?.trim();
    if (!category) continue;
    totals.set(category, (totals.get(category) ?? 0) + (item.quantity ?? 1));
  }
  return [...totals.entries()].map(([category, quantity]) => ({
    category,
    quantity,
  }));
}

export function collectContainerOptions(equipment: EquipmentItem[]) {
  return [
    ...new Set(
      equipment
        .filter(
          (item) =>
            equipmentIsOwned(item) &&
            typeof item.containerCapacityLb === "number",
        )
        .map((item) => item.name.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function summarizeContainers(equipment: EquipmentItem[]) {
  const owned = equipment.filter(equipmentIsOwned);
  const containerEntries = owned
    .filter((item) => item.containerCapacityLb !== undefined)
    .map((item) => ({
      item,
      name: item.name.trim(),
      normalizedName: item.name.trim().toLowerCase(),
      capacityLb: item.containerCapacityLb,
    }))
    .filter((entry) => entry.name.length > 0);
  const containerNameCounts = new Map<string, number>();
  for (const entry of containerEntries) {
    containerNameCounts.set(
      entry.normalizedName,
      (containerNameCounts.get(entry.normalizedName) ?? 0) + 1,
    );
  }
  const duplicateNames = [...containerNameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(
      ([normalizedName]) =>
        containerEntries.find(
          (entry) => entry.normalizedName === normalizedName,
        )?.name,
    )
    .filter((name): name is string => !!name);
  const entries = containerEntries.map((container) => {
    const contents = owned.filter(
      (entry) =>
        entry !== container.item &&
        entry.containerName?.trim().toLowerCase() === container.normalizedName,
    );
    const contentsWeightLb = contents.reduce(
      (sum, entry) => sum + (entry.weight ?? 0) * (entry.quantity ?? 1),
      0,
    );
    return {
      name: container.name,
      capacityLb: container.capacityLb,
      contentsCount: contents.length,
      contentsWeightLb,
      contentsNames: contents.map((entry) => entry.name),
      overloaded:
        typeof container.capacityLb === "number"
          ? contentsWeightLb > container.capacityLb
          : false,
      ambiguous: duplicateNames.includes(container.name),
    };
  });
  const assignedNames = new Set(
    containerEntries.map((entry) => entry.normalizedName),
  );
  const missingAssignments = owned
    .filter((item) => item.containerName?.trim())
    .filter(
      (item) => !assignedNames.has(item.containerName!.trim().toLowerCase()),
    )
    .map(
      (item) =>
        `${item.name} references missing container “${item.containerName?.trim()}”`,
    );
  const selfAssignments = owned
    .filter((item) => item.containerName?.trim())
    .filter(
      (item) =>
        item.containerName!.trim().toLowerCase() ===
        item.name.trim().toLowerCase(),
    )
    .map((item) => `${item.name} cannot contain itself. Shocking but true.`);
  const duplicateWarnings = duplicateNames.map(
    (name) =>
      `Multiple containers are named “${name}”. Rename them so assignments stop being a guessing game.`,
  );
  return { entries, missingAssignments, selfAssignments, duplicateWarnings };
}

function decrementEquipmentStack(
  item: EquipmentItem,
  amount: number,
): EquipmentItem | null {
  if ((item.usesRemaining ?? 0) > 0) {
    const nextUses = Math.max(0, (item.usesRemaining ?? 0) - amount);
    return { ...item, usesRemaining: nextUses };
  }
  const nextQuantity = Math.max(0, (item.quantity ?? 1) - amount);
  if (nextQuantity <= 0) return null;
  return { ...item, quantity: nextQuantity };
}

export function consumeAmmoFromEquipment(
  equipment: EquipmentItem[],
  ammoType: string | undefined,
  amount: number,
) {
  if (!ammoType?.trim() || amount <= 0) return { equipment, consumed: 0 };
  const normalized = normalizeAmmoType(ammoType);
  let remaining = amount;
  const nextEquipment: EquipmentItem[] = [];
  for (const item of equipment) {
    if (
      remaining > 0 &&
      equipmentIsOwned(item) &&
      normalizeAmmoType(item.ammoType ?? item.name) === normalized
    ) {
      const available = item.quantity ?? 1;
      const spend = Math.min(available, remaining);
      remaining -= spend;
      const nextItem = decrementEquipmentStack(item, spend);
      if (nextItem) nextEquipment.push(nextItem);
      continue;
    }
    nextEquipment.push(item);
  }
  return { equipment: nextEquipment, consumed: amount - remaining };
}

export function restoreAmmoToEquipment(
  equipment: EquipmentItem[],
  ammoType: string | undefined,
  amount: number,
  campaignRules?: CampaignRules | null,
) {
  if (!ammoType?.trim() || amount <= 0) return equipment;
  const normalized = normalizeAmmoType(ammoType);
  const index = equipment.findIndex(
    (item) =>
      equipmentIsOwned(item) &&
      normalizeAmmoType(item.ammoType ?? item.name) === normalized,
  );
  if (index >= 0) {
    return equipment.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, quantity: (item.quantity ?? 1) + amount }
        : item,
    );
  }
  return [
    ...equipment,
    { ...createAmmoStack(normalized, campaignRules), quantity: amount },
  ];
}

type SpellTriggerMode = "single" | "all";

interface ParsedSpellTrigger {
  spellName: string;
  mode: SpellTriggerMode;
}

function parseSpellTriggerEntry(entry: string): ParsedSpellTrigger | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("all:")) {
    const spellName = trimmed.slice(4).trim();
    return spellName ? { spellName, mode: "all" } : null;
  }
  return { spellName: trimmed, mode: "single" };
}

function itemConsumableUnits(item: EquipmentItem) {
  if ((item.usesRemaining ?? 0) > 0) return item.usesRemaining ?? 0;
  return Math.max(0, item.quantity ?? 1);
}

function itemAccessibilityRank(item: EquipmentItem) {
  if (item.equipped) return 0;
  if (item.carryState === "carried") return 1;
  if (item.carryState === "stowed" || !item.carryState) return 2;
  return 3;
}

function spellTriggerMatches(item: EquipmentItem, spellName: string) {
  const normalizedSpell = spellName.trim().toLowerCase();
  return (item.spellTriggerNames ?? [])
    .map(parseSpellTriggerEntry)
    .filter((entry): entry is ParsedSpellTrigger => !!entry)
    .filter((entry) => entry.spellName.toLowerCase() === normalizedSpell);
}

function compareSpellTriggerCandidates(a: EquipmentItem, b: EquipmentItem) {
  const triggerCountDelta =
    (a.spellTriggerNames?.length ?? 0) - (b.spellTriggerNames?.length ?? 0);
  if (triggerCountDelta !== 0) return triggerCountDelta;
  const accessibilityDelta =
    itemAccessibilityRank(a) - itemAccessibilityRank(b);
  if (accessibilityDelta !== 0) return accessibilityDelta;
  const unitsDelta = itemConsumableUnits(a) - itemConsumableUnits(b);
  if (unitsDelta !== 0) return unitsDelta;
  return a.name.localeCompare(b.name);
}

export function consumeSpellComponentFromEquipment(
  equipment: EquipmentItem[],
  spellName: string,
) {
  const owned = equipment.filter(
    (item) => equipmentIsOwned(item) && itemConsumableUnits(item) > 0,
  );
  const allMatches = owned.filter((item) =>
    spellTriggerMatches(item, spellName).some((entry) => entry.mode === "all"),
  );
  const singleCandidates = owned
    .filter((item) =>
      spellTriggerMatches(item, spellName).some(
        (entry) => entry.mode === "single",
      ),
    )
    .sort(compareSpellTriggerCandidates);
  const singleMatch = singleCandidates[0];
  const targets = [
    ...allMatches,
    ...(singleMatch && !allMatches.includes(singleMatch) ? [singleMatch] : []),
  ];
  if (targets.length <= 0) {
    return {
      equipment,
      consumedItemName: undefined,
      consumedItems: [] as Array<{ itemName: string; quantity: number }>,
    };
  }
  const targetSet = new Set(targets);
  const consumedItems: Array<{ itemName: string; quantity: number }> = [];
  const nextEquipment: EquipmentItem[] = [];
  for (const item of equipment) {
    if (targetSet.has(item)) {
      const nextItem = decrementEquipmentStack(item, 1);
      consumedItems.push({ itemName: item.name, quantity: 1 });
      if (nextItem) nextEquipment.push(nextItem);
      continue;
    }
    nextEquipment.push(item);
  }
  return {
    equipment: nextEquipment,
    consumedItemName: consumedItems[0]?.itemName,
    consumedItems,
  };
}

export function sortGearEntries(
  entries: Array<{ item: EquipmentItem; index: number }>,
  sortMode: GearSortMode,
) {
  if (sortMode === "manual") return entries;
  const sorted = [...entries];
  sorted.sort((a, b) => {
    if (sortMode === "equipped")
      return (
        Number(!!b.item.equipped) - Number(!!a.item.equipped) ||
        a.item.name.localeCompare(b.item.name)
      );
    if (sortMode === "weight")
      return (
        (b.item.weight ?? 0) - (a.item.weight ?? 0) ||
        a.item.name.localeCompare(b.item.name)
      );
    if (sortMode === "cost")
      return (
        (b.item.costGp ?? 0) - (a.item.costGp ?? 0) ||
        a.item.name.localeCompare(b.item.name)
      );
    if (sortMode === "quantity")
      return (
        (b.item.quantity ?? 0) - (a.item.quantity ?? 0) ||
        a.item.name.localeCompare(b.item.name)
      );
    return a.item.name.localeCompare(b.item.name);
  });
  return sorted;
}

export function groupGearEntries(
  entries: Array<{ item: EquipmentItem; index: number }>,
  groupMode: GearGroupMode,
) {
  if (groupMode === "none") return [{ key: "all", label: "All", entries }];
  const buckets = new Map<
    string,
    Array<{ item: EquipmentItem; index: number }>
  >();
  for (const entry of entries) {
    const key = groupKeyForItem(entry.item, groupMode);
    const current = buckets.get(key) ?? [];
    current.push(entry);
    buckets.set(key, current);
  }
  return [...buckets.entries()].map(([key, groupedEntries]) => ({
    key,
    label: groupLabelForKey(key, groupMode),
    entries: groupedEntries,
  }));
}

function groupKeyForItem(item: EquipmentItem, groupMode: GearGroupMode) {
  if (groupMode === "carry-state") return defaultCarryState(item);
  if (groupMode === "slot") return item.slot ?? "slotless";
  if (groupMode === "container") return item.containerName?.trim() || "loose";
  if (item.weapon) return "weapon";
  if (item.armor) return "armor";
  if (item.shield) return "shield";
  if (item.ammoType) return "ammo";
  if (item.componentCategory) return `component:${item.componentCategory}`;
  if (
    typeof item.usesMax === "number" ||
    typeof item.usesRemaining === "number"
  )
    return "consumable";
  return item.kind ?? "mundane";
}

function groupLabelForKey(key: string, groupMode: GearGroupMode) {
  if (groupMode === "carry-state") return displayCarryState(key as CarryState);
  if (groupMode === "slot") return key.replace(/-/g, " ");
  if (groupMode === "container")
    return key === "loose" ? "Loose / unbagged" : key;
  if (key.startsWith("component:"))
    return key.replace("component:", "").replace(/-/g, " ");
  return key;
}
