import {
  EQUIPMENT_SLOTS,
  abilityModifier,
  type CharacterBuild,
  type MagicItemDefinition,
  type WeaponDefinition,
  type DerivedSheet,
} from "@mathfinder/rules-engine";
import { useMemo, useState, type ReactNode } from "react";
import { CompendiumPicker, type CompendiumOption } from "./CompendiumPicker";
import { EquipmentSilhouette } from "./EquipmentSilhouette";
import type {
  RuntimeArmorDefinition,
  RuntimeMundaneEquipmentDefinition,
} from "../content";
import { spendCoinPurse, summarizeWealth } from "../wealth";
import {
  EQUIPMENT_COMPONENT_PRESETS,
  EQUIPMENT_USE_PRESETS,
  applyEquipmentComponentPreset,
  applyEquipmentUsePreset,
  collectContainerOptions,
  defaultCarryState,
  defaultOwnership,
  displayCarryState,
  displayOwnership,
  equipmentIsOwned,
  groupGearEntries,
  sortGearEntries,
  summarizeAmmoStacks,
  summarizeComponents,
  summarizeConsumables,
  summarizeContainers,
  summarizeWeaponAmmoCoverage,
  type GearGroupMode,
  type GearSortMode,
} from "../equipmentTools";
import {
  weaponAmmoUxLabel,
  weaponAvailabilityMatches,
  weaponTemplateLabel,
  type WeaponAvailabilityFilter,
} from "../weaponUx";
import { compatibleAmmoEntries } from "../ammoCatalog";
import {
  InventoryWorkspace,
  type InventoryEditTarget,
} from "./InventoryWorkspace";

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

interface EquipmentWeaponEditorState {
  enabled: boolean;
  weaponTemplateId?: string;
  category: "melee" | "ranged";
  proficiencyGroup?: "simple" | "martial" | "exotic";
  damageDice: string;
  handedness?: "one" | "two" | "off" | "light";
  critRange?: number;
  critMultiplier?: number;
  rangeIncrementFeet?: number;
  damageTypes?: Array<"bludgeoning" | "piercing" | "slashing">;
  specialTags?: string[];
  ammoType?: string;
  loadedAmmoType?: string;
  ammoPerAttack?: number;
  reloadType?: "free" | "move" | "full-round";
  firearmCategory?: "one-handed" | "two-handed" | "scatter";
  weaponTechnology?: "early" | "advanced";
  attackModifier?: number;
  extraDamageDice?: string[];
  ammoNotes?: string[];
  ordnanceProfile?: {
    saveDc?: number;
    saveType?: "fort" | "ref" | "will";
    area?: string;
    duration?: string;
    directHitEffect?: string;
    notes?: string[];
  };
  misfire?: number;
  targetsTouchAcWithinFirstRangeIncrement?: boolean;
  damageAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
}

const COMPONENT_CATEGORY_OPTIONS = [
  "material",
  "focus",
  "divine-focus",
  "spellbook",
  "kit",
] as const;

export interface GearTabProps {
  characterId?: string;
  sheet?: DerivedSheet;
  build: CharacterBuild;
  onUpdateCarriedWeight: (raw: string) => void;
  onUpdateCoinPurse: (
    denomination: "pp" | "gp" | "sp" | "cp",
    value: number,
  ) => void;
  onUpdateCoinWeightCountsTowardEncumbrance: (enabled: boolean) => void;
  onBuyEquipment: (index: number, quantity?: number) => void;
  onSellEquipment: (index: number, quantity?: number) => void;
  weaponOptions: WeaponDefinition[];
  magicItemOptions: MagicItemDefinition[];
  mundaneEquipmentOptions: RuntimeMundaneEquipmentDefinition[];
  armorOptions: RuntimeArmorDefinition[];
  onAddWeapon: () => void;
  onUpdateWeapon: (
    index: number,
    patch: Partial<NonNullable<CharacterBuild["weapons"]>[number]>,
  ) => void;
  onApplyWeaponTemplate: (index: number, weaponId: string) => void;
  onRemoveWeapon: (index: number) => void;
  onAddEquipment: () => void;
  onAddEquipmentFromTemplate: (itemId: string) => void;
  onAddArmorFromTemplate: (itemId: string) => void;
  onAddShieldFromTemplate: (itemId: string) => void;
  onAddMagicItem: () => void;
  onAddMagicItemFromTemplate: (itemId: string) => void;
  onUpdateEquipment: (
    index: number,
    patch: Partial<NonNullable<CharacterBuild["equipment"]>[number]>,
  ) => void;
  onUpdateEquipmentArmor: (
    index: number,
    patch: EquipmentArmorEditorState,
  ) => void;
  onUpdateEquipmentShield: (
    index: number,
    patch: EquipmentShieldEditorState,
  ) => void;
  onUpdateEquipmentWeapon: (
    index: number,
    patch: EquipmentWeaponEditorState,
  ) => void;
  onApplyEquipmentWeaponTemplate: (index: number, weaponId: string) => void;
  onApplyMagicItemTemplate: (index: number, itemId: string) => void;
  onApplyMundaneEquipmentTemplate: (index: number, itemId: string) => void;
  onApplyArmorTemplate: (index: number, itemId: string) => void;
  onApplyShieldTemplate: (index: number, itemId: string) => void;
  onStepMagicItemTier: (index: number, delta: -1 | 1) => void;
  onRemoveEquipment: (index: number) => void;
}

type Props = GearTabProps;
export function GearTab(props: Props) {
  return (
    <InventoryWorkspace
      {...props}
      renderEditor={(target, close) => (
        <InventoryEditor
          {...props}
          target={target}
          onRemoveEquipment={(index) => {
            props.onRemoveEquipment(index);
            close();
          }}
          onSellEquipment={(index, quantity = 1) => {
            props.onSellEquipment(index, quantity);
            if (quantity >= (props.build.equipment?.[index]?.quantity ?? 1))
              close();
          }}
          onRemoveWeapon={(index) => {
            props.onRemoveWeapon(index);
            close();
          }}
        />
      )}
    />
  );
}

function InventoryEditor(props: Props & { target: InventoryEditTarget }) {
  const {
    build,
    weaponOptions,
    magicItemOptions,
    mundaneEquipmentOptions,
    armorOptions,
  } = props;
  const equipment = useMemo(() => build.equipment ?? [], [build.equipment]);
  const wealthSummary = summarizeWealth(build);
  const [magicItemDraftByIndex, setMagicItemDraftByIndex] = useState<
    Record<number, string>
  >({});
  const [equipmentTemplateDraftByIndex, setEquipmentTemplateDraftByIndex] =
    useState<Record<number, string>>({});
  const [armorTemplateDraftByIndex, setArmorTemplateDraftByIndex] = useState<
    Record<number, string>
  >({});
  const [shieldTemplateDraftByIndex, setShieldTemplateDraftByIndex] = useState<
    Record<number, string>
  >({});
  const [magicQuickAddDraft, setMagicQuickAddDraft] = useState("");
  const [mundaneQuickAddDraft, setMundaneQuickAddDraft] = useState("");
  const [gearSearch, setGearSearch] = useState("");
  const [gearSlotFilter, setGearSlotFilter] = useState<
    NonNullable<CharacterBuild["equipment"]>[number]["slot"] | "all"
  >("all");
  const [gearCarryFilter, setGearCarryFilter] = useState<
    | NonNullable<
        NonNullable<CharacterBuild["equipment"]>[number]["carryState"]
      >
    | "all"
  >("all");
  const [gearOwnershipFilter, setGearOwnershipFilter] = useState<
    | NonNullable<NonNullable<CharacterBuild["equipment"]>[number]["ownership"]>
    | "all"
  >("all");
  const [gearComponentFilter, setGearComponentFilter] = useState<
    | NonNullable<
        NonNullable<CharacterBuild["equipment"]>[number]["componentCategory"]
      >
    | "ammo"
    | "any"
    | "none"
  >("any");
  const [gearSortMode, setGearSortMode] = useState<GearSortMode>("manual");
  const [gearGroupMode, setGearGroupMode] =
    useState<GearGroupMode>("carry-state");
  const [weaponAvailabilityFilter, setWeaponAvailabilityFilter] =
    useState<WeaponAvailabilityFilter>("all");
  const magicItemTemplateOptions = useMemo<CompendiumOption[]>(
    () =>
      magicItemOptions.map((item) => ({
        id: item.id,
        name: item.name,
        tooltip: [
          item.name,
          `Slot: ${displayEquipmentSlot(item.slot)}`,
          `Automation: ${item.automation.status}${item.automation.notes ? ` — ${item.automation.notes}` : ""}`,
          `Source: ${item.source}${item.sourcePage ? ` p.${item.sourcePage}` : ""}`,
          item.tags?.length ? `Tags: ${item.tags.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        searchText: [
          item.id,
          item.slot,
          item.source,
          item.tags?.join(" ") ?? "",
          item.automation.status,
          item.automation.notes ?? "",
        ],
        tags: [displayEquipmentSlot(item.slot), item.automation.status],
      })),
    [magicItemOptions],
  );
  const filteredWeaponOptions = useMemo(
    () =>
      weaponOptions.filter((weapon) =>
        weaponAvailabilityMatches(weapon, weaponAvailabilityFilter),
      ),
    [weaponAvailabilityFilter, weaponOptions],
  );
  const dexScore = useMemo(() => effectiveDexScore(build), [build]);
  const dexMod = abilityModifier(dexScore);
  const armorOnlyOptions = useMemo(
    () =>
      armorOptions.filter(
        (item) =>
          item.categoryNormalized && item.categoryNormalized !== "shield",
      ),
    [armorOptions],
  );
  const shieldOnlyOptions = useMemo(
    () => armorOptions.filter((item) => item.categoryNormalized === "shield"),
    [armorOptions],
  );
  const recommendedArmorByCategory = useMemo(
    () => recommendArmorByCategory(armorOnlyOptions, dexMod),
    [armorOnlyOptions, dexMod],
  );
  const recommendedArmorIds = useMemo(
    () => new Set(recommendedArmorByCategory.map((item) => item.id)),
    [recommendedArmorByCategory],
  );
  const armorTemplateOptions = useMemo<CompendiumOption[]>(
    () =>
      buildArmorCompendiumOptions(armorOnlyOptions, {
        dexMod,
        recommendedIds: recommendedArmorIds,
      }),
    [armorOnlyOptions, dexMod, recommendedArmorIds],
  );
  const shieldTemplateOptions = useMemo<CompendiumOption[]>(
    () => buildArmorCompendiumOptions(shieldOnlyOptions),
    [shieldOnlyOptions],
  );
  const unifiedEquipmentTemplateOptions = useMemo<CompendiumOption[]>(
    () => [
      ...buildMundaneEquipmentCompendiumOptions(mundaneEquipmentOptions),
      ...buildArmorCompendiumOptions(armorOptions),
    ],
    [armorOptions, mundaneEquipmentOptions],
  );
  const mundaneEquipment = equipment
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => (item.kind ?? "mundane") !== "magic");
  const magicEquipment = equipment
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        (item.kind ?? (item.itemTemplateId ? "magic" : "mundane")) === "magic",
    );
  const equippedSlots = buildEquippedSlotMap(equipment);
  const equipmentDiagnostics = useMemo(
    () => analyzeEquipment(equipment),
    [equipment],
  );
  const ammoSummary = useMemo(
    () => summarizeAmmoStacks(equipment),
    [equipment],
  );
  const consumableSummary = useMemo(
    () => summarizeConsumables(equipment),
    [equipment],
  );
  const ammoCoverage = useMemo(
    () => summarizeWeaponAmmoCoverage(build, equipment),
    [build, equipment],
  );
  const componentSummary = useMemo(
    () => summarizeComponents(equipment),
    [equipment],
  );
  const containerSummary = useMemo(
    () => summarizeContainers(equipment),
    [equipment],
  );
  const containerOptions = useMemo(
    () => collectContainerOptions(equipment),
    [equipment],
  );
  const equipmentSearch = gearSearch.trim().toLowerCase();
  const matchesGearFilter = (
    item: NonNullable<CharacterBuild["equipment"]>[number],
  ) => {
    const matchesSearch =
      equipmentSearch.length === 0 ||
      [
        item.name,
        item.itemTemplateId,
        item.slot,
        item.kind,
        item.armor?.category,
        item.weapon?.category,
        item.ammoType,
        item.carryState,
        item.containerName,
        item.componentCategory,
        item.spellTriggerNames?.join(" "),
        item.ownership,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(equipmentSearch));
    const matchesSlot =
      gearSlotFilter === "all" || item.slot === gearSlotFilter;
    const matchesCarry =
      gearCarryFilter === "all" || defaultCarryState(item) === gearCarryFilter;
    const matchesOwnership =
      gearOwnershipFilter === "all" ||
      defaultOwnership(item) === gearOwnershipFilter;
    const matchesComponent =
      gearComponentFilter === "any"
        ? true
        : gearComponentFilter === "none"
          ? !item.componentCategory && !item.ammoType
          : gearComponentFilter === "ammo"
            ? !!item.ammoType
            : item.componentCategory === gearComponentFilter;
    return (
      matchesSearch &&
      matchesSlot &&
      matchesCarry &&
      matchesOwnership &&
      matchesComponent
    );
  };
  const wishlistAffordable =
    spendCoinPurse(build.coinPurse, wealthSummary.wishlistCostGp) !== null;
  const equipmentTotals = equipment.reduce(
    (acc, item) => {
      const quantity = item.quantity ?? 1;
      acc.items += quantity;
      if (item.equipped) acc.equipped += quantity;
      if (equipmentIsOwned(item) && defaultCarryState(item) !== "cached")
        acc.weight += (item.weight ?? 0) * quantity;
      if (equipmentIsOwned(item)) acc.owned += quantity;
      else acc.wishlist += quantity;
      return acc;
    },
    { items: 0, equipped: 0, weight: 0, owned: 0, wishlist: 0 },
  );

  const visibleMundaneEquipment = sortGearEntries(
    mundaneEquipment.filter(
      ({ item, index }) =>
        matchesGearFilter(item) &&
        (props.target.kind !== "equipment" || index === props.target.index),
    ),
    gearSortMode,
  );
  const visibleMagicEquipment = sortGearEntries(
    magicEquipment.filter(
      ({ item, index }) =>
        matchesGearFilter(item) &&
        (props.target.kind !== "equipment" || index === props.target.index),
    ),
    gearSortMode,
  );
  const groupedMundaneEquipment = groupGearEntries(
    visibleMundaneEquipment,
    gearGroupMode,
  );
  const groupedMagicEquipment = groupGearEntries(
    visibleMagicEquipment,
    gearGroupMode,
  );

  return (
    <div
      className="build-page inventory-detail-editor"
      data-editor={props.target.kind}
      data-kind={
        props.target.kind === "equipment" &&
        (equipment[props.target.index]?.kind ??
          (equipment[props.target.index]?.itemTemplateId
            ? "magic"
            : "mundane")) === "magic"
          ? "magic"
          : "mundane"
      }
    >
      <section className="panel build-panel inventory-panel">
        <h2>Inventory</h2>
        <p className="hint">
          All the bags, steel, coins, and shiny nonsense live here now. Much
          less clutter. Revolutionary.
        </p>

        <EditorSection title="Inventory Overview">
          <label className="field compact">
            <span>
              Total carried weight override (lb){" "}
              <span className="muted">leave blank for gear + coins</span>
            </span>
            <input
              type="number"
              min={0}
              value={build.carriedWeight ?? ""}
              onChange={(e) => props.onUpdateCarriedWeight(e.target.value)}
            />
          </label>
          <div className="editor-grid">
            {(["pp", "gp", "sp", "cp"] as const).map((denomination) => (
              <label className="field compact" key={`coin-${denomination}`}>
                <span>{denomination.toUpperCase()}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={wealthSummary[denomination]}
                  onChange={(e) =>
                    props.onUpdateCoinPurse(
                      denomination,
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </label>
            ))}
            <label className="field compact checkbox-field">
              <span>Coin weight counts</span>
              <input
                type="checkbox"
                checked={build.coinWeightCountsTowardEncumbrance ?? true}
                onChange={(e) =>
                  props.onUpdateCoinWeightCountsTowardEncumbrance(
                    e.target.checked,
                  )
                }
              />
            </label>
          </div>
          <div className="equipment-summary-grid">
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Owned</span>
              <span className="summary-value compact-summary-value">
                {equipmentTotals.owned}
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Wishlist</span>
              <span className="summary-value compact-summary-value">
                {equipmentTotals.wishlist}
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Equipped</span>
              <span className="summary-value compact-summary-value">
                {equipmentTotals.equipped}
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Carried Weight</span>
              <span className="summary-value compact-summary-value">
                {formatCompactNumber(equipmentTotals.weight)} lb
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Equipment Value</span>
              <span className="summary-value compact-summary-value">
                {formatCompactNumber(wealthSummary.gearCostGp)} gp
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Coinpurse</span>
              <span className="summary-value compact-summary-value">
                {formatCompactNumber(wealthSummary.liquidWealthGp)} gp
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Coin Weight</span>
              <span className="summary-value compact-summary-value">
                {formatCompactNumber(wealthSummary.coinWeightLb)} lb
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Wishlist Cost</span>
              <span className="summary-value compact-summary-value">
                {formatCompactNumber(wealthSummary.wishlistCostGp)} gp
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Total Wealth</span>
              <span className="summary-value compact-summary-value">
                {formatCompactNumber(wealthSummary.totalWealthGp)} gp
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Ammo Stacks</span>
              <span className="summary-value compact-summary-value">
                {ammoSummary.length}
              </span>
            </div>
            <div className="stat-card compact-stat-card">
              <span className="summary-label">Consumables</span>
              <span className="summary-value compact-summary-value">
                {consumableSummary.length}
              </span>
            </div>
          </div>
          <div className="equipment-toolbar">
            <input
              type="text"
              value={gearSearch}
              onChange={(e) => setGearSearch(e.target.value)}
              placeholder="Search gear, slots, templates..."
            />
            <label className="spell-browser-sort">
              <span>Slot</span>
              <select
                value={gearSlotFilter ?? "all"}
                onChange={(e) =>
                  setGearSlotFilter(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as NonNullable<
                          CharacterBuild["equipment"]
                        >[number]["slot"]),
                  )
                }
              >
                <option value="all">All slots</option>
                {EQUIPMENT_SLOTS.map((slot) => (
                  <option key={`filter-slot-${slot}`} value={slot}>
                    {displayEquipmentSlot(slot)}
                  </option>
                ))}
              </select>
            </label>
            <label className="spell-browser-sort">
              <span>Carry</span>
              <select
                value={gearCarryFilter}
                onChange={(e) =>
                  setGearCarryFilter(e.target.value as typeof gearCarryFilter)
                }
              >
                <option value="all">All carry states</option>
                <option value="carried">carried</option>
                <option value="stowed">stowed</option>
                <option value="cached">cached</option>
              </select>
            </label>
            <label className="spell-browser-sort">
              <span>Ownership</span>
              <select
                value={gearOwnershipFilter}
                onChange={(e) =>
                  setGearOwnershipFilter(
                    e.target.value as typeof gearOwnershipFilter,
                  )
                }
              >
                <option value="all">All items</option>
                <option value="owned">owned</option>
                <option value="wishlist">wishlist</option>
              </select>
            </label>
            <label className="spell-browser-sort">
              <span>Kind</span>
              <select
                value={gearComponentFilter}
                onChange={(e) =>
                  setGearComponentFilter(
                    e.target.value as typeof gearComponentFilter,
                  )
                }
              >
                <option value="any">All kinds</option>
                <option value="ammo">Ammo</option>
                <option value="material">Material</option>
                <option value="focus">Focus</option>
                <option value="divine-focus">Divine Focus</option>
                <option value="spellbook">Spellbook</option>
                <option value="kit">Kit</option>
                <option value="none">Other</option>
              </select>
            </label>
            <label className="spell-browser-sort">
              <span>Sort</span>
              <select
                value={gearSortMode}
                onChange={(e) =>
                  setGearSortMode(e.target.value as GearSortMode)
                }
              >
                <option value="manual">Manual</option>
                <option value="name">Name</option>
                <option value="equipped">Equipped</option>
                <option value="quantity">Quantity</option>
                <option value="weight">Weight</option>
                <option value="cost">Cost</option>
              </select>
            </label>
            <label className="spell-browser-sort">
              <span>Group</span>
              <select
                value={gearGroupMode}
                onChange={(e) =>
                  setGearGroupMode(e.target.value as GearGroupMode)
                }
              >
                <option value="none">None</option>
                <option value="carry-state">Carry State</option>
                <option value="slot">Slot</option>
                <option value="usage">Usage</option>
                <option value="container">Container</option>
              </select>
            </label>
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setGearSearch("");
                setGearSlotFilter("all");
                setGearCarryFilter("all");
                setGearOwnershipFilter("all");
                setGearComponentFilter("any");
                setGearSortMode("manual");
                setGearGroupMode("carry-state");
              }}
            >
              Reset Filters
            </button>
          </div>
          <div className="resource-buttons wrap">
            {[
              {
                label: "Owned",
                onClick: () => setGearOwnershipFilter("owned"),
              },
              {
                label: "Wishlist",
                onClick: () => setGearOwnershipFilter("wishlist"),
              },
              {
                label: "Carried",
                onClick: () => setGearCarryFilter("carried"),
              },
              { label: "Cached", onClick: () => setGearCarryFilter("cached") },
              { label: "Ammo", onClick: () => setGearComponentFilter("ammo") },
              {
                label: "Material",
                onClick: () => setGearComponentFilter("material"),
              },
              { label: "Loose", onClick: () => setGearGroupMode("container") },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="ghost small"
                onClick={chip.onClick}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {equipmentDiagnostics.warnings.length > 0 ? (
            <div className="equipment-warning-list">
              {equipmentDiagnostics.warnings.map((warning) => (
                <span className="spell-issue-badge" key={warning}>
                  {warning}
                </span>
              ))}
            </div>
          ) : (
            <div className="ok-pill">No slot conflicts. Miracles happen.</div>
          )}
          {[
            ...containerSummary.missingAssignments,
            ...containerSummary.selfAssignments,
            ...containerSummary.duplicateWarnings,
          ].length > 0 ? (
            <div className="equipment-warning-list">
              {[
                ...containerSummary.missingAssignments,
                ...containerSummary.selfAssignments,
                ...containerSummary.duplicateWarnings,
              ].map((warning) => (
                <span className="spell-issue-badge" key={warning}>
                  {warning}
                </span>
              ))}
            </div>
          ) : null}
          {containerSummary.entries.some((entry) => entry.overloaded) ? (
            <div className="equipment-warning-list">
              {containerSummary.entries
                .filter((entry) => entry.overloaded)
                .map((entry) => (
                  <span className="spell-issue-badge" key={entry.name}>
                    {entry.name} overloaded:{" "}
                    {formatCompactNumber(entry.contentsWeightLb)} /{" "}
                    {formatCompactNumber(entry.capacityLb ?? 0)} lb
                  </span>
                ))}
            </div>
          ) : null}
          {!wishlistAffordable && wealthSummary.wishlistCostGp > 0 ? (
            <div className="equipment-warning-list">
              <span className="spell-issue-badge">
                Wishlist exceeds coinpurse by{" "}
                {formatCompactNumber(
                  wealthSummary.wishlistCostGp - wealthSummary.liquidWealthGp,
                )}{" "}
                gp. Shopping spree denied.
              </span>
            </div>
          ) : null}
          {ammoCoverage.missing.length > 0 ? (
            <div className="equipment-warning-list">
              {ammoCoverage.missing.map((warning) => (
                <span className="spell-issue-badge" key={warning}>
                  {warning}
                </span>
              ))}
            </div>
          ) : null}
          <p className="hint">
            Auto-equip sanity is active: equipping a conflicting armor, shield,
            or slot item will bump the loser off instead of preserving illegal
            clown-fiesta loadouts.
          </p>
          {ammoSummary.length > 0 ? (
            <p className="hint">
              Ammo:{" "}
              {ammoSummary
                .map(({ ammoType, quantity }) => `${ammoType} ×${quantity}`)
                .join(" · ")}
            </p>
          ) : null}
          {ammoCoverage.covered.length > 0 ? (
            <p className="hint">
              Weapon ammo coverage:{" "}
              {ammoCoverage.covered
                .map(
                  ({ weaponName, ammoType, quantity }) =>
                    `${weaponName} → ${ammoType} (${quantity})`,
                )
                .join(" · ")}
            </p>
          ) : null}
          {componentSummary.length > 0 ? (
            <p className="hint">
              Components:{" "}
              {componentSummary
                .map(({ category, quantity }) => `${category} ×${quantity}`)
                .join(" · ")}
            </p>
          ) : null}
          {containerSummary.entries.length > 0 ? (
            <p className="hint">
              Containers:{" "}
              {containerSummary.entries
                .filter(
                  (entry) =>
                    entry.contentsCount > 0 ||
                    typeof entry.capacityLb === "number",
                )
                .map(
                  (entry) =>
                    `${entry.name} ${formatCompactNumber(entry.contentsWeightLb)}${typeof entry.capacityLb === "number" ? `/${formatCompactNumber(entry.capacityLb)} lb` : " lb"}`,
                )
                .join(" · ")}
            </p>
          ) : null}
          {consumableSummary.length > 0 ? (
            <p className="hint">
              Consumables:{" "}
              {consumableSummary
                .map(
                  ({ name, usesRemaining, usesMax }) =>
                    `${name} ${usesRemaining}/${usesMax}`,
                )
                .join(" · ")}
            </p>
          ) : null}
          <p className="hint">
            Magic items and mundane gear are split now because we are, against
            all odds, capable of sorting objects.
          </p>
          <EquipmentSilhouette equippedSlots={equippedSlots} />
        </EditorSection>

        <EditorSection
          title="Weapons"
          action={
            <button className="ghost small" onClick={props.onAddWeapon}>
              Add Weapon
            </button>
          }
        >
          <div className="editor-grid armor-stat-grid">
            <label className="field compact">
              <span>Template availability</span>
              <select
                value={weaponAvailabilityFilter}
                onChange={(event) =>
                  setWeaponAvailabilityFilter(
                    event.target.value as WeaponAvailabilityFilter,
                  )
                }
              >
                <option value="all">All</option>
                <option value="early">Early firearms</option>
                <option value="advanced">Advanced firearms</option>
                <option value="ordnance">Ordnance / launchers</option>
              </select>
            </label>
            <div className="hint">
              Showing {filteredWeaponOptions.length} template
              {filteredWeaponOptions.length === 1 ? "" : "s"}. Tiny arsenal,
              huge consequences.
            </div>
          </div>
          {(build.weapons ?? [])
            .map((weapon, index) => ({ weapon, index }))
            .filter(
              ({ index }) =>
                props.target.kind !== "weapon" || index === props.target.index,
            )
            .map(({ weapon, index }) => (
              <div className="item-card" key={`weapon-${index}`}>
                <div className="editor-grid">
                  <label className="field compact">
                    <span>Template</span>
                    <select
                      value={weapon.weaponTemplateId ?? ""}
                      onChange={(e) => {
                        if (e.target.value)
                          props.onApplyWeaponTemplate(index, e.target.value);
                        else
                          props.onUpdateWeapon(index, {
                            weaponTemplateId: undefined,
                          });
                      }}
                    >
                      <option value="">Custom / select template…</option>
                      {filteredWeaponOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {weaponTemplateLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field compact">
                    <span>Name</span>
                    <input
                      type="text"
                      value={weapon.name}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, { name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field compact">
                    <span>Category</span>
                    <select
                      value={weapon.category}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, {
                          category: e.target.value as "melee" | "ranged",
                        })
                      }
                    >
                      <option value="melee">Melee</option>
                      <option value="ranged">Ranged</option>
                    </select>
                  </label>
                  <label className="field compact">
                    <span>Proficiency</span>
                    <select
                      value={weapon.proficiencyGroup ?? "simple"}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, {
                          proficiencyGroup: e.target.value as
                            "simple" | "martial" | "exotic",
                        })
                      }
                    >
                      <option value="simple">Simple</option>
                      <option value="martial">Martial</option>
                      <option value="exotic">Exotic</option>
                    </select>
                  </label>
                  <label className="field compact">
                    <span>Damage dice</span>
                    <input
                      type="text"
                      value={weapon.damageDice}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, {
                          damageDice: e.target.value || "1d6",
                        })
                      }
                    />
                  </label>
                  <label className="field compact">
                    <span>Handedness</span>
                    <select
                      value={weapon.handedness ?? "one"}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, {
                          handedness: e.target.value as
                            "one" | "two" | "off" | "light",
                        })
                      }
                    >
                      <option value="one">One-Handed</option>
                      <option value="two">Two-Handed</option>
                      <option value="off">Off-Hand</option>
                      <option value="light">Light</option>
                    </select>
                  </label>
                  <label className="field compact">
                    <span>Crit range</span>
                    <input
                      type="number"
                      min={18}
                      max={20}
                      value={weapon.critRange ?? 20}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, {
                          critRange: Math.max(
                            18,
                            Math.min(20, Number(e.target.value) || 20),
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field compact">
                    <span>Crit multiplier</span>
                    <input
                      type="number"
                      min={2}
                      max={5}
                      value={weapon.critMultiplier ?? 2}
                      onChange={(e) =>
                        props.onUpdateWeapon(index, {
                          critMultiplier: Math.max(
                            2,
                            Math.min(5, Number(e.target.value) || 2),
                          ),
                        })
                      }
                    />
                  </label>
                  {compatibleAmmoOptions(weapon.ammoType).length > 0 ? (
                    <label className="field compact">
                      <span>Loaded ammo</span>
                      <select
                        value={weapon.loadedAmmoType ?? ""}
                        onChange={(e) =>
                          props.onUpdateWeapon(index, {
                            loadedAmmoType: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Base ammo</option>
                        {compatibleAmmoOptions(weapon.ammoType).map(
                          (option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : null}
                </div>
                {weaponAmmoUxLabel(weapon) ? (
                  <p className="hint">{weaponAmmoUxLabel(weapon)}</p>
                ) : null}
                <div className="item-actions">
                  <button
                    className="ghost small"
                    onClick={() => props.onRemoveWeapon(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
        </EditorSection>

        <EditorSection
          title="Magic Items"
          action={
            <div className="equipment-section-actions">
              <button className="ghost small" onClick={props.onAddMagicItem}>
                Add Magic Item
              </button>
              <div className="equipment-quick-add-picker">
                <CompendiumPicker
                  value={magicQuickAddDraft}
                  onChange={(value) => {
                    setMagicQuickAddDraft(value);
                    const match = magicItemOptions.find(
                      (option) =>
                        option.name.toLowerCase() ===
                        value.trim().toLowerCase(),
                    );
                    if (!match) return;
                    props.onAddMagicItemFromTemplate(match.id);
                    setMagicQuickAddDraft("");
                  }}
                  options={magicItemTemplateOptions}
                  placeholder="Quick add magic item..."
                />
              </div>
            </div>
          }
        >
          {magicEquipment.length === 0 ? (
            <p className="hint">
              No magic items yet. Your wizard is crying in a perfectly ordinary
              robe.
            </p>
          ) : null}
          {magicEquipment.length > 0 && visibleMagicEquipment.length === 0 ? (
            <p className="hint">
              No magic items match the current filters. Amazing work, detective.
            </p>
          ) : null}
          {groupedMagicEquipment.map((group) => (
            <div
              key={`magic-group-${group.key}`}
              className="equipment-group-block"
            >
              {gearGroupMode !== "none" ? (
                <div className="subsection-title equipment-group-title">
                  {group.label}
                </div>
              ) : null}
              {group.entries.map(({ item, index }) =>
                renderEquipmentCard({
                  item,
                  index,
                  mode: "magic",
                  props,
                  allMagicItemOptions: magicItemOptions,
                  mundaneEquipmentOptions,
                  armorOptions,
                  magicItemTemplateOptions,
                  unifiedEquipmentTemplateOptions,
                  armorTemplateOptions,
                  shieldTemplateOptions,
                  dexMod,
                  recommendedArmorByCategory,
                  weaponOptions: filteredWeaponOptions,
                  containerOptions,
                  magicItemDraft: magicItemDraftByIndex[index],
                  equipmentTemplateDraft: undefined,
                  armorTemplateDraft: undefined,
                  shieldTemplateDraft: undefined,
                  onMagicItemDraftChange: (value) =>
                    setMagicItemDraftByIndex((prev) => ({
                      ...prev,
                      [index]: value,
                    })),
                  onEquipmentTemplateDraftChange: () => undefined,
                  onArmorTemplateDraftChange: () => undefined,
                  onShieldTemplateDraftChange: () => undefined,
                  onClearMagicItemDraft: () =>
                    setMagicItemDraftByIndex((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    }),
                  onClearEquipmentTemplateDraft: () => undefined,
                  onClearArmorTemplateDraft: () => undefined,
                  onClearShieldTemplateDraft: () => undefined,
                }),
              )}
            </div>
          ))}
        </EditorSection>

        <EditorSection
          title="Mundane Equipment"
          action={
            <div className="equipment-section-actions">
              <button className="ghost small" onClick={props.onAddEquipment}>
                Add Item
              </button>
              <div className="equipment-quick-add-picker">
                <CompendiumPicker
                  value={mundaneQuickAddDraft}
                  onChange={(value) => {
                    setMundaneQuickAddDraft(value);
                    const trimmed = value.trim().toLowerCase();
                    const mundaneMatch = mundaneEquipmentOptions.find(
                      (option) => option.name.toLowerCase() === trimmed,
                    );
                    if (mundaneMatch) {
                      props.onAddEquipmentFromTemplate(mundaneMatch.id);
                      setMundaneQuickAddDraft("");
                      return;
                    }
                    const armorMatch = armorOptions.find(
                      (option) => option.name.toLowerCase() === trimmed,
                    );
                    if (!armorMatch) return;
                    if (armorMatch.categoryNormalized === "shield")
                      props.onAddShieldFromTemplate(armorMatch.id);
                    else props.onAddArmorFromTemplate(armorMatch.id);
                    setMundaneQuickAddDraft("");
                  }}
                  options={unifiedEquipmentTemplateOptions}
                  placeholder="Quick add gear, armor, shield..."
                />
              </div>
            </div>
          }
        >
          <p className="hint">
            Running totals update live. Armor-only fields stay hidden unless the
            item is actually armor. Stunning innovation.
          </p>
          {mundaneEquipment.length === 0 ? (
            <p className="hint">
              No mundane gear yet. Add an item and stop sending your hero into
              danger naked.
            </p>
          ) : null}
          {mundaneEquipment.length > 0 &&
          visibleMundaneEquipment.length === 0 ? (
            <p className="hint">
              No mundane gear matches the current filters. You filtered too
              hard.
            </p>
          ) : null}
          {groupedMundaneEquipment.map((group) => (
            <div
              key={`mundane-group-${group.key}`}
              className="equipment-group-block"
            >
              {gearGroupMode !== "none" ? (
                <div className="subsection-title equipment-group-title">
                  {group.label}
                </div>
              ) : null}
              {group.entries.map(({ item, index }) =>
                renderEquipmentCard({
                  item,
                  index,
                  mode: "mundane",
                  props,
                  allMagicItemOptions: magicItemOptions,
                  mundaneEquipmentOptions,
                  armorOptions,
                  magicItemTemplateOptions,
                  unifiedEquipmentTemplateOptions,
                  armorTemplateOptions,
                  shieldTemplateOptions,
                  dexMod,
                  recommendedArmorByCategory,
                  weaponOptions: filteredWeaponOptions,
                  containerOptions,
                  magicItemDraft: undefined,
                  equipmentTemplateDraft: equipmentTemplateDraftByIndex[index],
                  armorTemplateDraft: armorTemplateDraftByIndex[index],
                  shieldTemplateDraft: shieldTemplateDraftByIndex[index],
                  onMagicItemDraftChange: () => undefined,
                  onEquipmentTemplateDraftChange: (value) =>
                    setEquipmentTemplateDraftByIndex((prev) => ({
                      ...prev,
                      [index]: value,
                    })),
                  onArmorTemplateDraftChange: (value) =>
                    setArmorTemplateDraftByIndex((prev) => ({
                      ...prev,
                      [index]: value,
                    })),
                  onShieldTemplateDraftChange: (value) =>
                    setShieldTemplateDraftByIndex((prev) => ({
                      ...prev,
                      [index]: value,
                    })),
                  onClearMagicItemDraft: () => undefined,
                  onClearEquipmentTemplateDraft: () =>
                    setEquipmentTemplateDraftByIndex((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    }),
                  onClearArmorTemplateDraft: () =>
                    setArmorTemplateDraftByIndex((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    }),
                  onClearShieldTemplateDraft: () =>
                    setShieldTemplateDraftByIndex((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    }),
                }),
              )}
            </div>
          ))}
        </EditorSection>
      </section>
    </div>
  );
}

function renderEquipmentCard({
  item,
  index,
  mode,
  props,
  allMagicItemOptions,
  mundaneEquipmentOptions,
  armorOptions,
  magicItemTemplateOptions,
  unifiedEquipmentTemplateOptions,
  armorTemplateOptions,
  shieldTemplateOptions,
  dexMod,
  recommendedArmorByCategory,
  weaponOptions,
  containerOptions,
  magicItemDraft,
  equipmentTemplateDraft,
  armorTemplateDraft,
  shieldTemplateDraft,
  onMagicItemDraftChange,
  onEquipmentTemplateDraftChange,
  onArmorTemplateDraftChange,
  onShieldTemplateDraftChange,
  onClearMagicItemDraft,
  onClearEquipmentTemplateDraft,
  onClearArmorTemplateDraft,
  onClearShieldTemplateDraft,
}: {
  item: NonNullable<CharacterBuild["equipment"]>[number];
  index: number;
  mode: "magic" | "mundane";
  props: Props;
  allMagicItemOptions: MagicItemDefinition[];
  mundaneEquipmentOptions: RuntimeMundaneEquipmentDefinition[];
  armorOptions: RuntimeArmorDefinition[];
  magicItemTemplateOptions: CompendiumOption[];
  unifiedEquipmentTemplateOptions: CompendiumOption[];
  armorTemplateOptions: CompendiumOption[];
  shieldTemplateOptions: CompendiumOption[];
  dexMod: number;
  recommendedArmorByCategory: RuntimeArmorDefinition[];
  weaponOptions: WeaponDefinition[];
  containerOptions: string[];
  magicItemDraft?: string;
  equipmentTemplateDraft?: string;
  armorTemplateDraft?: string;
  shieldTemplateDraft?: string;
  onMagicItemDraftChange: (value: string) => void;
  onEquipmentTemplateDraftChange: (value: string) => void;
  onArmorTemplateDraftChange: (value: string) => void;
  onShieldTemplateDraftChange: (value: string) => void;
  onClearMagicItemDraft: () => void;
  onClearEquipmentTemplateDraft: () => void;
  onClearArmorTemplateDraft: () => void;
  onClearShieldTemplateDraft: () => void;
}) {
  const armor: EquipmentArmorEditorState = item.armor
    ? {
        category: item.armor.category ?? "light",
        acBonus: item.armor.acBonus,
        maxDexBonus: item.armor.maxDexBonus,
        checkPenalty: item.armor.checkPenalty,
        speedPenalty: item.armor.speedPenalty,
      }
    : {
        category: "none",
        acBonus: undefined,
        maxDexBonus: undefined,
        checkPenalty: undefined,
        speedPenalty: undefined,
      };
  const shield: EquipmentShieldEditorState = item.shield
    ? {
        enabled: true,
        acBonus: item.shield.acBonus,
        checkPenalty: item.shield.checkPenalty,
      }
    : { enabled: false, acBonus: undefined, checkPenalty: undefined };
  const weapon: EquipmentWeaponEditorState = item.weapon
    ? {
        enabled: true,
        weaponTemplateId: item.weapon.weaponTemplateId,
        category: item.weapon.category,
        proficiencyGroup: item.weapon.proficiencyGroup,
        damageDice: item.weapon.damageDice,
        handedness: item.weapon.handedness,
        critRange: item.weapon.critRange,
        critMultiplier: item.weapon.critMultiplier,
        rangeIncrementFeet: item.weapon.rangeIncrementFeet,
        damageTypes: item.weapon.damageTypes,
        specialTags: item.weapon.specialTags,
        ammoType: item.weapon.ammoType,
        loadedAmmoType: item.weapon.loadedAmmoType,
        ammoPerAttack: item.weapon.ammoPerAttack,
        reloadType: item.weapon.reloadType,
        firearmCategory: item.weapon.firearmCategory,
        weaponTechnology: item.weapon.weaponTechnology,
        attackModifier: item.weapon.attackModifier,
        extraDamageDice: item.weapon.extraDamageDice,
        ammoNotes: item.weapon.ammoNotes,
        ordnanceProfile: item.weapon.ordnanceProfile,
        misfire: item.weapon.misfire,
        targetsTouchAcWithinFirstRangeIncrement:
          item.weapon.targetsTouchAcWithinFirstRangeIncrement,
        damageAbility: item.weapon.damageAbility,
      }
    : {
        enabled: false,
        weaponTemplateId: undefined,
        category: "melee",
        proficiencyGroup: "simple",
        damageDice: "1d6",
        handedness: "one",
        critRange: 20,
        critMultiplier: 2,
        rangeIncrementFeet: undefined,
        damageTypes: undefined,
        specialTags: undefined,
        ammoType: undefined,
        loadedAmmoType: undefined,
        ammoPerAttack: undefined,
        reloadType: undefined,
        firearmCategory: undefined,
        weaponTechnology: undefined,
        attackModifier: undefined,
        extraDamageDice: undefined,
        ammoNotes: undefined,
        ordnanceProfile: undefined,
        misfire: undefined,
        targetsTouchAcWithinFirstRangeIncrement: undefined,
        damageAbility: undefined,
      };
  const quantity = item.quantity ?? 1;
  const weightEach = item.weight ?? 0;
  const costEach = item.costGp ?? 0;
  const totalWeight = quantity * weightEach;
  const totalCost = quantity * costEach;
  const currentMagicItem = item.itemTemplateId
    ? allMagicItemOptions.find((option) => option.id === item.itemTemplateId)
    : undefined;
  const currentMundaneEquipment =
    mode === "mundane" && item.itemTemplateId
      ? mundaneEquipmentOptions.find(
          (option) => option.id === item.itemTemplateId,
        )
      : undefined;
  const currentArmorTemplate =
    mode === "mundane" && item.itemTemplateId
      ? armorOptions.find(
          (option) =>
            option.id === item.itemTemplateId &&
            option.categoryNormalized !== "shield",
        )
      : undefined;
  const currentShieldTemplate =
    mode === "mundane" && item.itemTemplateId
      ? armorOptions.find(
          (option) =>
            option.id === item.itemTemplateId &&
            option.categoryNormalized === "shield",
        )
      : undefined;
  const magicItemPickerValue = magicItemDraft ?? currentMagicItem?.name ?? "";
  const equipmentTemplatePickerValue =
    equipmentTemplateDraft ??
    currentArmorTemplate?.name ??
    currentShieldTemplate?.name ??
    currentMundaneEquipment?.name ??
    "";
  const armorTemplatePickerValue =
    armorTemplateDraft ?? currentArmorTemplate?.name ?? "";
  const shieldTemplatePickerValue =
    shieldTemplateDraft ?? currentShieldTemplate?.name ?? "";
  const ownership = defaultOwnership(item);
  const spellTriggerText = (item.spellTriggerNames ?? []).join(", ");
  const isArmor = armor.category !== "none";
  const isShield = shield.enabled;
  const isWeapon = weapon.enabled;
  const canAffordOne =
    spendCoinPurse(props.build.coinPurse, item.costGp ?? 0) !== null;
  return (
    <div
      className="item-card equipment-card equipment-card-condensed"
      key={`equipment-${index}`}
    >
      <div className="equipment-row equipment-row-head">
        <label className="field compact equipment-name-field">
          <span>Name</span>
          <input
            type="text"
            value={item.name}
            onChange={(e) =>
              props.onUpdateEquipment(index, { name: e.target.value })
            }
          />
        </label>
        <label className="field compact equipment-mini-field">
          <span>Qty</span>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) =>
              props.onUpdateEquipment(index, {
                quantity: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </label>
        <label className="field compact equipment-mini-field">
          <span>Cost</span>
          <input
            type="number"
            min={0}
            value={costEach}
            onChange={(e) =>
              props.onUpdateEquipment(index, {
                costGp: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </label>
        <label className="field compact equipment-mini-field">
          <span>Wt</span>
          <input
            type="number"
            min={0}
            value={weightEach}
            onChange={(e) =>
              props.onUpdateEquipment(index, {
                weight: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </label>
        <label className="field compact checkbox-field equipment-check-field">
          <span>Eq</span>
          <input
            type="checkbox"
            checked={!!item.equipped}
            onChange={(e) =>
              props.onUpdateEquipment(index, { equipped: e.target.checked })
            }
          />
        </label>
        <div className="equipment-row-totals buff-desc">
          Total {formatCompactNumber(totalCost)} gp ·{" "}
          {formatCompactNumber(totalWeight)} lb
        </div>
        <div className="equipment-card-tags">
          {item.slot ? (
            <span className="tag">{displayEquipmentSlot(item.slot)}</span>
          ) : null}
          <span className="tag feature">{displayOwnership(ownership)}</span>
          <span className="tag feature">
            {displayCarryState(defaultCarryState(item))}
          </span>
          {mode === "magic" ? (
            <span className="tag feature">magic</span>
          ) : (
            <span className="tag feature">mundane</span>
          )}
          {currentMagicItem ? (
            <span className="tag feature">
              tier {currentMagicItem.upgradeTier ?? 1}
            </span>
          ) : null}
          {item.containerName ? (
            <span className="tag feature">in {item.containerName}</span>
          ) : null}
          {typeof item.containerCapacityLb === "number" ? (
            <span className="tag feature">
              container {formatCompactNumber(item.containerCapacityLb)} lb
            </span>
          ) : null}
          {item.componentCategory ? (
            <span className="tag feature">{item.componentCategory}</span>
          ) : null}
          {item.spellTriggerNames?.length ? (
            <span className="tag feature">
              spells: {item.spellTriggerNames.join(", ")}
            </span>
          ) : null}
          {item.ammoType ? (
            <span className="tag feature">ammo: {item.ammoType}</span>
          ) : null}
          {typeof item.usesRemaining === "number" ||
          typeof item.usesMax === "number" ? (
            <span className="tag feature">
              uses {item.usesRemaining ?? 0}/{item.usesMax ?? 0}
            </span>
          ) : null}
          {isArmor ? (
            <span className="tag feature">{armor.category} armor</span>
          ) : null}
          {isShield ? <span className="tag feature">shield</span> : null}
          {isWeapon ? <span className="tag feature">weapon</span> : null}
        </div>
      </div>
      <details className="equipment-details">
        <summary>Details</summary>
        <div className="editor-grid equipment-grid">
          {mode === "magic" ? (
            <div className="field compact template-search-block">
              <span>Magic item template</span>
              <CompendiumPicker
                value={magicItemPickerValue}
                onChange={(value) => {
                  onMagicItemDraftChange(value);
                  const match = allMagicItemOptions.find(
                    (option) =>
                      option.name.toLowerCase() === value.trim().toLowerCase(),
                  );
                  if (match) {
                    props.onApplyMagicItemTemplate(index, match.id);
                    onClearMagicItemDraft();
                  }
                }}
                options={magicItemTemplateOptions}
                placeholder="Search templates: ring, wizardry, protection..."
              />
              <div className="field-help">
                {currentMagicItem
                  ? `Selected: ${currentMagicItem.id} · ${displayEquipmentSlot(currentMagicItem.slot)}`
                  : "No template selected"}
              </div>
              <div className="resource-buttons wrap">
                <button
                  type="button"
                  className={
                    item.itemTemplateId
                      ? "ghost small"
                      : "ghost small active-template-choice"
                  }
                  onClick={() => {
                    props.onUpdateEquipment(index, {
                      itemTemplateId: undefined,
                      kind: "magic",
                    });
                    onClearMagicItemDraft();
                  }}
                >
                  Custom / none
                </button>
              </div>
            </div>
          ) : null}
          {mode === "mundane" ? (
            <div className="field compact template-search-block">
              <span>Equipment template</span>
              <CompendiumPicker
                value={equipmentTemplatePickerValue}
                onChange={(value) => {
                  onEquipmentTemplateDraftChange(value);
                  const trimmed = value.trim().toLowerCase();
                  const mundaneMatch = mundaneEquipmentOptions.find(
                    (option) => option.name.toLowerCase() === trimmed,
                  );
                  if (mundaneMatch) {
                    props.onApplyMundaneEquipmentTemplate(
                      index,
                      mundaneMatch.id,
                    );
                    onClearEquipmentTemplateDraft();
                    return;
                  }
                  const armorMatch = armorOptions.find(
                    (option) => option.name.toLowerCase() === trimmed,
                  );
                  if (!armorMatch) return;
                  if (armorMatch.categoryNormalized === "shield")
                    props.onApplyShieldTemplate(index, armorMatch.id);
                  else props.onApplyArmorTemplate(index, armorMatch.id);
                  onClearEquipmentTemplateDraft();
                }}
                options={unifiedEquipmentTemplateOptions}
                placeholder="Search gear, armor, shields..."
              />
              <div className="field-help">
                {describeSelectedEquipmentTemplate(
                  currentMundaneEquipment ??
                    currentArmorTemplate ??
                    currentShieldTemplate,
                )}
              </div>
              <div className="resource-buttons wrap">
                <button
                  type="button"
                  className={
                    item.itemTemplateId
                      ? "ghost small"
                      : "ghost small active-template-choice"
                  }
                  onClick={() => {
                    props.onUpdateEquipment(index, {
                      itemTemplateId: undefined,
                      kind: "mundane",
                    });
                    onClearEquipmentTemplateDraft();
                    onClearArmorTemplateDraft();
                    onClearShieldTemplateDraft();
                  }}
                >
                  Custom / none
                </button>
              </div>
            </div>
          ) : null}
          {mode === "magic" ? (
            <label className="field compact">
              <span>Magic item slot</span>
              <select
                value={item.slot ?? "slotless"}
                onChange={(e) =>
                  props.onUpdateEquipment(index, {
                    slot:
                      e.target.value === "slotless"
                        ? undefined
                        : (e.target.value as NonNullable<
                            CharacterBuild["equipment"]
                          >[number]["slot"]),
                    kind: "magic",
                  })
                }
              >
                {EQUIPMENT_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {displayEquipmentSlot(slot)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field compact">
            <span>Ownership</span>
            <select
              value={ownership}
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  ownership: e.target.value as NonNullable<
                    NonNullable<
                      CharacterBuild["equipment"]
                    >[number]["ownership"]
                  >,
                })
              }
            >
              <option value="owned">owned</option>
              <option value="wishlist">wishlist</option>
            </select>
          </label>
          <label className="field compact">
            <span>Carry state</span>
            <select
              value={defaultCarryState(item)}
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  carryState: e.target.value as NonNullable<
                    NonNullable<
                      CharacterBuild["equipment"]
                    >[number]["carryState"]
                  >,
                  equipped: e.target.value === "cached" ? false : item.equipped,
                })
              }
            >
              <option value="carried">carried</option>
              <option value="stowed">stowed</option>
              <option value="cached">cached</option>
            </select>
          </label>
          <label className="field compact">
            <span>Container</span>
            <>
              <input
                type="text"
                list={`container-options-${index}`}
                value={item.containerName ?? ""}
                placeholder="backpack, satchel..."
                onChange={(e) =>
                  props.onUpdateEquipment(index, {
                    containerName: e.target.value.trim() || undefined,
                  })
                }
              />
              <datalist id={`container-options-${index}`}>
                {containerOptions.map((option) => (
                  <option key={`${index}-${option}`} value={option} />
                ))}
              </datalist>
            </>
          </label>
          <label className="field compact">
            <span>Capacity lb</span>
            <input
              type="number"
              min={0}
              value={item.containerCapacityLb ?? ""}
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  containerCapacityLb:
                    e.target.value === ""
                      ? undefined
                      : Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label className="field compact">
            <span>Component</span>
            <select
              value={item.componentCategory ?? "none"}
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  componentCategory:
                    e.target.value === "none"
                      ? undefined
                      : (e.target.value as NonNullable<
                          NonNullable<
                            CharacterBuild["equipment"]
                          >[number]["componentCategory"]
                        >),
                })
              }
            >
              <option value="none">Not a component item</option>
              {COMPONENT_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact">
            <span>Spell triggers</span>
            <input
              type="text"
              value={spellTriggerText}
              placeholder="magic missile, bless, all:stoneskin..."
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  spellTriggerNames: e.target.value
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="field compact">
            <span>Ammo type</span>
            <input
              type="text"
              value={item.ammoType ?? ""}
              placeholder="arrow, bolt, bullet..."
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  ammoType: e.target.value.trim() || undefined,
                })
              }
            />
          </label>
          <label className="field compact">
            <span>Uses left</span>
            <input
              type="number"
              min={0}
              value={item.usesRemaining ?? ""}
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  usesRemaining:
                    e.target.value === ""
                      ? undefined
                      : Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label className="field compact">
            <span>Uses max</span>
            <input
              type="number"
              min={0}
              value={item.usesMax ?? ""}
              onChange={(e) =>
                props.onUpdateEquipment(index, {
                  usesMax:
                    e.target.value === ""
                      ? undefined
                      : Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label className="field compact">
            <span>Armor category</span>
            <select
              value={armor.category}
              onChange={(e) =>
                props.onUpdateEquipmentArmor(index, {
                  ...armor,
                  category: e.target
                    .value as EquipmentArmorEditorState["category"],
                })
              }
            >
              <option value="none">Not armor</option>
              <option value="light">Light armor</option>
              <option value="medium">Medium armor</option>
              <option value="heavy">Heavy armor</option>
            </select>
          </label>
          <label className="field compact checkbox-field">
            <span>Shield</span>
            <input
              type="checkbox"
              checked={isShield}
              onChange={(e) =>
                props.onUpdateEquipmentShield(index, {
                  ...shield,
                  enabled: e.target.checked,
                })
              }
            />
          </label>
          <label className="field compact checkbox-field">
            <span>Weapon</span>
            <input
              type="checkbox"
              checked={isWeapon}
              onChange={(e) =>
                props.onUpdateEquipmentWeapon(index, {
                  ...weapon,
                  enabled: e.target.checked,
                })
              }
            />
          </label>
        </div>
        <div className="equipment-preset-row">
          {EQUIPMENT_USE_PRESETS.map((preset) => (
            <button
              key={`${item.name}-${preset.id}`}
              type="button"
              className="ghost small"
              onClick={() =>
                props.onUpdateEquipment(
                  index,
                  applyEquipmentUsePreset(
                    item,
                    preset.id,
                    props.build.campaignRules,
                  ),
                )
              }
            >
              {preset.label}
            </button>
          ))}
          {EQUIPMENT_COMPONENT_PRESETS.map((preset) => (
            <button
              key={`${item.name}-${preset.id}`}
              type="button"
              className="ghost small"
              onClick={() =>
                props.onUpdateEquipment(
                  index,
                  applyEquipmentComponentPreset(item, preset.id),
                )
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
        {currentMagicItem ? (
          <div className="equipment-armor-box">
            <div className="editor-section-head tight">
              <div className="subsection-title">Magic Item Tier</div>
              <div className="equipment-tier-controls">
                <button
                  className="ghost small"
                  disabled={!currentMagicItem.downgradeToId}
                  onClick={() => props.onStepMagicItemTier(index, -1)}
                >
                  Downgrade
                </button>
                <span className="buff-desc">
                  Tier {currentMagicItem.upgradeTier ?? 1} ·{" "}
                  {displayEquipmentSlot(currentMagicItem.slot)}
                </span>
                <button
                  className="ghost small"
                  disabled={!currentMagicItem.upgradeToId}
                  onClick={() => props.onStepMagicItemTier(index, 1)}
                >
                  Upgrade
                </button>
              </div>
            </div>
            <div className="magic-item-meta-list">
              <div className="buff-desc">
                Automation: {currentMagicItem.automation.status}
                {currentMagicItem.automation.notes
                  ? ` — ${currentMagicItem.automation.notes}`
                  : ""}
              </div>
              <div className="buff-desc">
                Source: {currentMagicItem.source}
                {currentMagicItem.sourcePage
                  ? ` p.${currentMagicItem.sourcePage}`
                  : ""}
              </div>
              {currentMagicItem.tags?.length ? (
                <div className="buff-desc">
                  Tags: {currentMagicItem.tags.join(", ")}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {mode === "mundane" ? (
          <div className="equipment-armor-box">
            <div className="subsection-title">Armor Template</div>
            <div className="editor-grid armor-stat-grid">
              <div className="field compact template-search-block">
                <span>Armor template</span>
                <CompendiumPicker
                  value={armorTemplatePickerValue}
                  onChange={(value) => {
                    onArmorTemplateDraftChange(value);
                    const match = armorOptions.find(
                      (option) =>
                        option.categoryNormalized !== "shield" &&
                        option.name.toLowerCase() ===
                          value.trim().toLowerCase(),
                    );
                    if (match) {
                      props.onApplyArmorTemplate(index, match.id);
                      onClearArmorTemplateDraft();
                    }
                  }}
                  options={armorTemplateOptions}
                  placeholder="Search armor: chainmail, breastplate..."
                />
                <div className="field-help">
                  {describeArmorTemplate(currentArmorTemplate, dexMod)}
                </div>
                <div className="equipment-armor-recommendations">
                  {recommendedArmorByCategory.map((option) => (
                    <span
                      key={`armor-rec-${option.id}`}
                      className="chip feature"
                    >
                      {option.categoryNormalized}: {option.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {isArmor ? (
          <div className="equipment-armor-box">
            <div className="subsection-title">Armor Stats</div>
            <div className="editor-grid armor-stat-grid">
              <label className="field compact">
                <span>Armor AC bonus</span>
                <input
                  type="number"
                  min={0}
                  value={armor.acBonus ?? ""}
                  onChange={(e) =>
                    props.onUpdateEquipmentArmor(index, {
                      ...armor,
                      acBonus:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="field compact">
                <span>Max Dex</span>
                <input
                  type="number"
                  value={armor.maxDexBonus ?? ""}
                  onChange={(e) =>
                    props.onUpdateEquipmentArmor(index, {
                      ...armor,
                      maxDexBonus:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field compact">
                <span>Armor check penalty</span>
                <input
                  type="number"
                  value={armor.checkPenalty ?? ""}
                  onChange={(e) =>
                    props.onUpdateEquipmentArmor(index, {
                      ...armor,
                      checkPenalty:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field compact">
                <span>Speed penalty</span>
                <input
                  type="number"
                  min={0}
                  value={armor.speedPenalty ?? ""}
                  onChange={(e) =>
                    props.onUpdateEquipmentArmor(index, {
                      ...armor,
                      speedPenalty:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ) : null}
        {mode === "mundane" ? (
          <div className="equipment-armor-box">
            <div className="subsection-title">Shield Template</div>
            <div className="editor-grid armor-stat-grid">
              <div className="field compact template-search-block">
                <span>Shield template</span>
                <CompendiumPicker
                  value={shieldTemplatePickerValue}
                  onChange={(value) => {
                    onShieldTemplateDraftChange(value);
                    const match = armorOptions.find(
                      (option) =>
                        option.categoryNormalized === "shield" &&
                        option.name.toLowerCase() ===
                          value.trim().toLowerCase(),
                    );
                    if (match) {
                      props.onApplyShieldTemplate(index, match.id);
                      onClearShieldTemplateDraft();
                    }
                  }}
                  options={shieldTemplateOptions}
                  placeholder="Search shields: buckler, tower shield..."
                />
                <div className="field-help">
                  {describeShieldTemplate(currentShieldTemplate)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {isShield ? (
          <div className="equipment-armor-box">
            <div className="subsection-title">Shield Stats</div>
            <div className="editor-grid armor-stat-grid">
              <label className="field compact">
                <span>Shield AC bonus</span>
                <input
                  type="number"
                  min={0}
                  value={shield.acBonus ?? ""}
                  onChange={(e) =>
                    props.onUpdateEquipmentShield(index, {
                      ...shield,
                      enabled: true,
                      acBonus:
                        e.target.value === ""
                          ? undefined
                          : Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="field compact">
                <span>Shield check penalty</span>
                <input
                  type="number"
                  value={shield.checkPenalty ?? ""}
                  onChange={(e) =>
                    props.onUpdateEquipmentShield(index, {
                      ...shield,
                      enabled: true,
                      checkPenalty:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ) : null}
        {isWeapon ? (
          <div className="equipment-armor-box">
            <div className="subsection-title">Weapon Stats</div>
            <div className="editor-grid armor-stat-grid">
              <label className="field compact">
                <span>Weapon template</span>
                <select
                  value={weapon.weaponTemplateId ?? ""}
                  onChange={(e) => {
                    if (e.target.value)
                      props.onApplyEquipmentWeaponTemplate(
                        index,
                        e.target.value,
                      );
                    else
                      props.onUpdateEquipmentWeapon(index, {
                        ...weapon,
                        enabled: true,
                        weaponTemplateId: undefined,
                      });
                  }}
                >
                  <option value="">Custom / select template…</option>
                  {weaponOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {weaponTemplateLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact">
                <span>Weapon category</span>
                <select
                  value={weapon.category}
                  onChange={(e) =>
                    props.onUpdateEquipmentWeapon(index, {
                      ...weapon,
                      enabled: true,
                      category: e.target
                        .value as EquipmentWeaponEditorState["category"],
                    })
                  }
                >
                  <option value="melee">Melee</option>
                  <option value="ranged">Ranged</option>
                </select>
              </label>
              <label className="field compact">
                <span>Weapon proficiency</span>
                <select
                  value={weapon.proficiencyGroup ?? "simple"}
                  onChange={(e) =>
                    props.onUpdateEquipmentWeapon(index, {
                      ...weapon,
                      enabled: true,
                      proficiencyGroup: e.target.value as NonNullable<
                        EquipmentWeaponEditorState["proficiencyGroup"]
                      >,
                    })
                  }
                >
                  <option value="simple">Simple</option>
                  <option value="martial">Martial</option>
                  <option value="exotic">Exotic</option>
                </select>
              </label>
              <label className="field compact">
                <span>Damage dice</span>
                <input
                  type="text"
                  value={weapon.damageDice}
                  onChange={(e) =>
                    props.onUpdateEquipmentWeapon(index, {
                      ...weapon,
                      enabled: true,
                      damageDice: e.target.value || "1d6",
                    })
                  }
                />
              </label>
              <label className="field compact">
                <span>Handedness</span>
                <select
                  value={weapon.handedness ?? "one"}
                  onChange={(e) =>
                    props.onUpdateEquipmentWeapon(index, {
                      ...weapon,
                      enabled: true,
                      handedness: e.target.value as NonNullable<
                        EquipmentWeaponEditorState["handedness"]
                      >,
                    })
                  }
                >
                  <option value="one">One-Handed</option>
                  <option value="two">Two-Handed</option>
                  <option value="off">Off-Hand</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label className="field compact">
                <span>Crit range</span>
                <input
                  type="number"
                  min={18}
                  max={20}
                  value={weapon.critRange ?? 20}
                  onChange={(e) =>
                    props.onUpdateEquipmentWeapon(index, {
                      ...weapon,
                      enabled: true,
                      critRange: Math.max(
                        18,
                        Math.min(20, Number(e.target.value) || 20),
                      ),
                    })
                  }
                />
              </label>
              <label className="field compact">
                <span>Crit multiplier</span>
                <input
                  type="number"
                  min={2}
                  max={5}
                  value={weapon.critMultiplier ?? 2}
                  onChange={(e) =>
                    props.onUpdateEquipmentWeapon(index, {
                      ...weapon,
                      enabled: true,
                      critMultiplier: Math.max(
                        2,
                        Math.min(5, Number(e.target.value) || 2),
                      ),
                    })
                  }
                />
              </label>
              {compatibleAmmoOptions(weapon.ammoType).length > 0 ? (
                <label className="field compact">
                  <span>Loaded ammo</span>
                  <select
                    value={weapon.loadedAmmoType ?? ""}
                    onChange={(e) =>
                      props.onUpdateEquipmentWeapon(index, {
                        ...weapon,
                        enabled: true,
                        loadedAmmoType: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Base ammo</option>
                    {compatibleAmmoOptions(weapon.ammoType).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="item-actions">
          <button
            className="ghost small"
            disabled={!canAffordOne}
            onClick={() => props.onBuyEquipment(index, 1)}
          >
            Buy 1
          </button>
          <button
            className="ghost small"
            disabled={
              spendCoinPurse(
                props.build.coinPurse,
                costEach * Math.min(5, Math.max(1, item.quantity ?? 1)),
              ) === null
            }
            onClick={() =>
              props.onBuyEquipment(
                index,
                Math.min(5, Math.max(1, item.quantity ?? 1)),
              )
            }
          >
            Buy {Math.min(5, Math.max(1, item.quantity ?? 1))}
          </button>
          {ownership === "wishlist" && (item.quantity ?? 1) > 1 ? (
            <button
              className="ghost small"
              disabled={
                spendCoinPurse(props.build.coinPurse, totalCost) === null
              }
              onClick={() => props.onBuyEquipment(index, item.quantity ?? 1)}
            >
              Buy All
            </button>
          ) : null}
          {ownership === "owned" ? (
            <button
              className="ghost small"
              onClick={() => props.onSellEquipment(index, 1)}
            >
              Sell 1
            </button>
          ) : null}
          {ownership === "owned" && (item.quantity ?? 1) > 1 ? (
            <button
              className="ghost small"
              onClick={() =>
                props.onSellEquipment(index, Math.min(5, item.quantity ?? 1))
              }
            >
              Sell {Math.min(5, item.quantity ?? 1)}
            </button>
          ) : null}
          {ownership === "owned" && (item.quantity ?? 1) > 1 ? (
            <button
              className="ghost small"
              onClick={() => props.onSellEquipment(index, item.quantity ?? 1)}
            >
              Sell All
            </button>
          ) : null}
          {typeof item.usesRemaining === "number" ? (
            <button
              className="ghost small"
              onClick={() =>
                props.onUpdateEquipment(index, {
                  usesRemaining: Math.max(0, (item.usesRemaining ?? 0) - 1),
                })
              }
            >
              Use
            </button>
          ) : null}
          {typeof item.usesRemaining === "number" ? (
            <button
              className="ghost small"
              onClick={() =>
                props.onUpdateEquipment(index, {
                  usesRemaining: Math.min(
                    item.usesMax ?? Number.POSITIVE_INFINITY,
                    (item.usesRemaining ?? 0) + 1,
                  ),
                })
              }
            >
              Restore Use
            </button>
          ) : null}
          {typeof item.usesMax === "number" ? (
            <button
              className="ghost small"
              onClick={() =>
                props.onUpdateEquipment(index, { usesRemaining: item.usesMax })
              }
            >
              Refill
            </button>
          ) : null}
          <button
            className="ghost small"
            onClick={() => props.onRemoveEquipment(index)}
          >
            Remove
          </button>
        </div>
      </details>
    </div>
  );
}

function buildEquippedSlotMap(
  equipment: NonNullable<CharacterBuild["equipment"]>,
) {
  const slots = new Map<string, string[]>();
  for (const item of equipment.filter(equipmentIsOwned)) {
    if (!item.equipped || !item.slot || item.slot === "slotless") continue;
    const current = slots.get(item.slot) ?? [];
    current.push(item.name);
    slots.set(item.slot, current);
  }
  return slots;
}

function analyzeEquipment(equipment: NonNullable<CharacterBuild["equipment"]>) {
  const owned = equipment.filter(equipmentIsOwned);
  const equippedBySlot = buildEquippedSlotMap(owned);
  const warnings: string[] = [];
  for (const [slot, names] of equippedBySlot.entries()) {
    const limit = slot === "ring" ? 2 : 1;
    if (names.length > limit) {
      warnings.push(
        `${displayEquipmentSlot(slot as Exclude<NonNullable<CharacterBuild["equipment"]>[number]["slot"], undefined>)} overloaded: ${names.join(", ")}`,
      );
    }
  }
  const armorNames = owned
    .filter((item) => item.equipped && item.armor)
    .map((item) => item.name);
  if (armorNames.length > 1)
    warnings.push(`Multiple armor pieces equipped: ${armorNames.join(", ")}`);
  const shieldNames = owned
    .filter((item) => item.equipped && item.shield)
    .map((item) => item.name);
  if (shieldNames.length > 1)
    warnings.push(`Multiple shields equipped: ${shieldNames.join(", ")}`);
  return { warnings };
}

function EditorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const sectionKey = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section className={`gear-editor-section gear-${sectionKey}`}>
      <div className="editor-section-head">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="item-list">{children}</div>
    </section>
  );
}

function compatibleAmmoOptions(ammoType: string | undefined) {
  return compatibleAmmoEntries(ammoType).map((entry) => ({
    value: entry.ammoType,
    label: entry.name,
  }));
}

function buildMundaneEquipmentCompendiumOptions(
  items: RuntimeMundaneEquipmentDefinition[],
): CompendiumOption[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    tooltip: [
      item.name,
      item.categoryRaw ? `Category: ${item.categoryRaw}` : "",
      typeof item.costGp === "number"
        ? `Cost: ${formatCompactNumber(item.costGp)} gp`
        : "",
      typeof item.weightLb === "number"
        ? `Weight: ${formatCompactNumber(item.weightLb)} lb`
        : "",
      item.source ? `Source: ${item.source}` : "",
      item.description ?? "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    searchText: [
      item.id,
      item.categoryRaw ?? "",
      item.source ?? "",
      item.description ?? "",
    ],
    tags: [item.categoryRaw ?? "mundane"],
  }));
}

function sign(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function effectiveDexScore(build: CharacterBuild) {
  let score = build.baseAbilityScores.dex ?? 10;
  const selectedAlternateTraitIds = new Set(
    (build.race.choiceSelection?.alternateTraits ?? []).map((id) =>
      id.toLowerCase(),
    ),
  );
  const activeAlternateTraits = (build.race.alternateTraits ?? []).filter(
    (trait) => selectedAlternateTraitIds.has(trait.id.toLowerCase()),
  );
  for (const mod of [
    ...(build.race.abilityModifiers ?? []),
    ...activeAlternateTraits.flatMap((trait) => trait.abilityModifiers ?? []),
  ]) {
    if (mod.target === "dex") score += mod.value;
  }
  const flexibleBonus = build.race.choiceOptions?.flexibleAbilityBonus;
  if (
    build.race.choiceSelection?.flexibleAbility === "dex" &&
    flexibleBonus?.value
  )
    score += flexibleBonus.value;
  for (const level of build.levels) {
    if (level.abilityIncrease === "dex") score += 1;
  }
  return score;
}

function effectiveArmorAc(item: RuntimeArmorDefinition, dexMod: number) {
  const armorBonus = item.armorBonus ?? 0;
  const appliedDex =
    typeof item.maxDexBonus === "number"
      ? Math.min(dexMod, item.maxDexBonus)
      : dexMod;
  return armorBonus + appliedDex;
}

function recommendArmorByCategory(
  items: RuntimeArmorDefinition[],
  dexMod: number,
) {
  const byCategory = new Map<string, RuntimeArmorDefinition[]>();
  for (const item of items) {
    const category = item.categoryNormalized;
    if (!category || category === "shield") continue;
    byCategory.set(category, [...(byCategory.get(category) ?? []), item]);
  }
  return [...byCategory.entries()]
    .map(
      ([, entries]) =>
        [...entries].sort((a, b) => {
          const effectiveDiff =
            effectiveArmorAc(b, dexMod) - effectiveArmorAc(a, dexMod);
          if (effectiveDiff !== 0) return effectiveDiff;
          const penaltyDiff =
            (b.armorCheckPenalty ?? -99) - (a.armorCheckPenalty ?? -99);
          if (penaltyDiff !== 0) return penaltyDiff;
          const costDiff =
            (a.costGp ?? Number.MAX_SAFE_INTEGER) -
            (b.costGp ?? Number.MAX_SAFE_INTEGER);
          if (costDiff !== 0) return costDiff;
          return (
            (a.weightLb ?? Number.MAX_SAFE_INTEGER) -
            (b.weightLb ?? Number.MAX_SAFE_INTEGER)
          );
        })[0],
    )
    .filter((item): item is RuntimeArmorDefinition => !!item);
}

function buildArmorCompendiumOptions(
  items: RuntimeArmorDefinition[],
  options?: { dexMod?: number; recommendedIds?: Set<string> },
): CompendiumOption[] {
  return items.map((item) => {
    const effectiveAc = effectiveArmorAc(item, options?.dexMod ?? 0);
    const dexTags: string[] = [];
    if (
      options?.recommendedIds?.has(item.id) &&
      item.categoryNormalized !== "shield"
    ) {
      dexTags.push(`best @ Dex ${sign(options.dexMod ?? 0)}`);
    } else if (
      typeof options?.dexMod === "number" &&
      item.categoryNormalized !== "shield" &&
      typeof item.maxDexBonus === "number" &&
      item.maxDexBonus >= options.dexMod
    ) {
      dexTags.push("fits Dex");
    }
    return {
      id: item.id,
      name: item.name,
      tooltip: [
        item.name,
        item.categoryRaw ? `Category: ${item.categoryRaw}` : "",
        typeof item.armorBonus === "number"
          ? `AC Bonus: ${item.armorBonus}`
          : "",
        typeof item.maxDexBonus === "number"
          ? `Max Dex: ${item.maxDexBonus}`
          : "",
        typeof options?.dexMod === "number" &&
        item.categoryNormalized !== "shield"
          ? `Effective AC @ Dex ${sign(options.dexMod)}: ${sign(effectiveAc)}`
          : "",
        typeof item.armorCheckPenalty === "number"
          ? `Check Penalty: ${item.armorCheckPenalty}`
          : "",
        typeof item.costGp === "number"
          ? `Cost: ${formatCompactNumber(item.costGp)} gp`
          : "",
        typeof item.weightLb === "number"
          ? `Weight: ${formatCompactNumber(item.weightLb)} lb`
          : "",
        item.source ? `Source: ${item.source}` : "",
        item.description ?? "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      searchText: [
        item.id,
        item.categoryRaw ?? "",
        item.source ?? "",
        item.description ?? "",
      ],
      tags: [item.categoryNormalized ?? "armor", ...dexTags],
    };
  });
}

function describeSelectedEquipmentTemplate(
  item: RuntimeMundaneEquipmentDefinition | RuntimeArmorDefinition | undefined,
) {
  if (!item) return "No template selected";
  const type =
    "categoryNormalized" in item
      ? item.categoryNormalized === "shield"
        ? "shield"
        : `${item.categoryNormalized ?? "armor"} armor`
      : (item.categoryRaw ?? "mundane");
  return [
    type,
    typeof item.costGp === "number"
      ? `${formatCompactNumber(item.costGp)} gp`
      : "cost n/a",
    typeof item.weightLb === "number"
      ? `${formatCompactNumber(item.weightLb)} lb`
      : "weight n/a",
  ].join(" · ");
}

function describeArmorTemplate(
  item: RuntimeArmorDefinition | undefined,
  dexMod?: number,
) {
  if (!item) return "No armor template selected";
  return [
    `${item.categoryNormalized ?? "armor"}`,
    typeof item.armorBonus === "number" ? `AC +${item.armorBonus}` : "AC n/a",
    typeof item.maxDexBonus === "number"
      ? `Max Dex ${item.maxDexBonus}`
      : "Max Dex n/a",
    typeof dexMod === "number"
      ? `Effective @ Dex ${sign(dexMod)}: ${sign(effectiveArmorAc(item, dexMod))}`
      : "",
    typeof item.costGp === "number"
      ? `${formatCompactNumber(item.costGp)} gp`
      : "cost n/a",
  ]
    .filter(Boolean)
    .join(" · ");
}

function describeShieldTemplate(item: RuntimeArmorDefinition | undefined) {
  if (!item) return "No shield template selected";
  return [
    "shield",
    typeof item.armorBonus === "number" ? `AC +${item.armorBonus}` : "AC n/a",
    typeof item.armorCheckPenalty === "number"
      ? `ACP ${item.armorCheckPenalty}`
      : "ACP n/a",
    typeof item.costGp === "number"
      ? `${formatCompactNumber(item.costGp)} gp`
      : "cost n/a",
  ].join(" · ");
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function displayEquipmentSlot(
  slot: Exclude<
    NonNullable<CharacterBuild["equipment"]>[number]["slot"],
    undefined
  >,
) {
  return slot === "slotless" ? "slotless" : slot.replace(/-/g, " ");
}
