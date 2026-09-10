import { useMemo, useState, type ReactNode } from "react";
import { EQUIPMENT_SLOTS } from "@mathfinder/rules-engine";
import type { GearTabProps } from "./GearTab";
import { EquipmentSilhouette } from "./EquipmentSilhouette";
import { CharacterDialog } from "./CharacterDialog";
import { useCharacterUiState } from "../features/characters/CharacterUiSession";
import {
  defaultCarryState,
  equipmentIsOwned,
  sortGearEntries,
  groupGearEntries,
  type GearSortMode,
  type GearGroupMode,
} from "../equipmentTools";
import { summarizeWealth } from "../wealth";
import { sign } from "../util";

export type InventoryEditTarget =
  { kind: "equipment" | "weapon"; index: number } | { kind: "overview" };
export type InventoryCatalogEntry = {
  id: string;
  name: string;
  kind: "magic" | "mundane" | "armor" | "shield" | "weapon";
  detail: string;
  slot?: string;
  cost?: number;
  source?: string;
};
export function filterInventoryCatalog(
  entries: InventoryCatalogEntry[],
  query: string,
  kind: string,
  slot: string,
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries
    .filter(
      (entry) =>
        (!kind || entry.kind === kind) &&
        (!slot || entry.slot === slot) &&
        words.every((word) =>
          `${entry.name} ${entry.detail} ${entry.source ?? ""} ${entry.slot ?? ""}`
            .toLowerCase()
            .includes(word),
        ),
    )
    .sort((a, b) => {
      const rank = (name: string) =>
        words.length && words.every((word) => name.toLowerCase().includes(word))
          ? 0
          : 1;
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });
}
const number = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function InventoryWorkspace(
  props: GearTabProps & {
    renderEditor: (target: InventoryEditTarget, close: () => void) => ReactNode;
  },
) {
  const { build, sheet, characterId = "local" } = props;
  const equipment = build.equipment ?? [];
  const wealth = summarizeWealth(build);
  const [coinAmount, setCoinAmount] = useState("");
  const amountGp = Number(coinAmount);
  const validAmount =
    Number.isFinite(amountGp) && amountGp > 0 && Math.round(amountGp * 100) > 0;
  const [railOpen, setRailOpen] = useCharacterUiState(
    characterId,
    "inventory-rail",
    true,
  );
  const [query, setQuery] = useCharacterUiState(
    characterId,
    "inventory-query",
    "",
  );
  const [scope, setScope] = useCharacterUiState<"owned" | "catalog">(
    characterId,
    "inventory-scope",
    "owned",
  );
  const [slot, setSlot] = useCharacterUiState(
    characterId,
    "inventory-slot",
    "",
  );
  const [kind, setKind] = useCharacterUiState(
    characterId,
    "inventory-kind",
    "",
  );
  const [location, setLocation] = useCharacterUiState(
    characterId,
    "inventory-location",
    "",
  );
  const [usage, setUsage] = useCharacterUiState(
    characterId,
    "inventory-usage",
    "",
  );
  const [ownership, setOwnership] = useCharacterUiState(
    characterId,
    "inventory-ownership",
    "",
  );
  const [sort, setSort] = useCharacterUiState<GearSortMode>(
    characterId,
    "inventory-sort",
    "manual",
  );
  const [group, setGroup] = useCharacterUiState<GearGroupMode>(
    characterId,
    "inventory-group",
    "none",
  );
  const [target, setTarget] = useCharacterUiState<InventoryEditTarget | null>(
    characterId,
    "inventory-edit",
    null,
  );
  const [coins, setCoins] = useCharacterUiState(
    characterId,
    "inventory-coins",
    false,
  );
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const equippedSlots = new Map<string, string[]>();
  for (const item of equipment)
    if (equipmentIsOwned(item) && item.equipped && item.slot)
      equippedSlots.set(item.slot, [
        ...(equippedSlots.get(item.slot) ?? []),
        item.name,
      ]);
  const catalog = useMemo<InventoryCatalogEntry[]>(
    () => [
      ...props.magicItemOptions.map((item) => ({
        id: item.id,
        name: item.name,
        kind: "magic" as const,
        slot: item.slot,
        detail: item.automation.notes || item.automation.status,
        source: item.source,
      })),
      ...props.mundaneEquipmentOptions.map((item) => ({
        id: item.id,
        name: item.name,
        kind: "mundane" as const,
        detail: item.description ?? item.categoryRaw ?? "Equipment",
        cost: item.costGp,
        source: item.source,
      })),
      ...props.armorOptions.map((item) => ({
        id: item.id,
        name: item.name,
        kind:
          item.categoryNormalized === "shield"
            ? ("shield" as const)
            : ("armor" as const),
        slot: item.categoryNormalized === "shield" ? "shield" : "armor",
        detail: `AC +${item.armorBonus ?? 0} · ${item.categoryRaw ?? "Armor"}`,
        cost: item.costGp,
        source: item.source,
      })),
      ...props.weaponOptions.map((item) => ({
        id: item.id,
        name: item.name,
        kind: "weapon" as const,
        detail: `${item.damageDice} · ${item.category}`,
      })),
    ],
    [
      props.magicItemOptions,
      props.mundaneEquipmentOptions,
      props.armorOptions,
      props.weaponOptions,
    ],
  );
  const results = filterInventoryCatalog(catalog, query, kind, slot);
  const pages = Math.max(1, Math.ceil(results.length / 30)),
    currentPage = Math.min(page, pages - 1);
  const visible = sortGearEntries(
    equipment
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const itemKind = item.weapon
          ? "weapon"
          : item.armor
            ? "armor"
            : item.shield
              ? "shield"
              : (item.kind ?? (item.itemTemplateId ? "magic" : "mundane"));
        return (
          (scope === "catalog" ||
            !query ||
            `${item.name} ${item.slot ?? ""} ${item.containerName ?? ""} ${item.ammoType ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!slot || item.slot === slot) &&
          (!kind || itemKind === kind) &&
          (!ownership ||
            (ownership === "owned"
              ? equipmentIsOwned(item)
              : !equipmentIsOwned(item))) &&
          (!usage ||
            (usage === "ammo"
              ? !!item.ammoType
              : usage === "other"
                ? !item.ammoType && !item.componentCategory
                : item.componentCategory === usage)) &&
          (!location ||
            (location === "wishlist"
              ? !equipmentIsOwned(item)
              : defaultCarryState(item) === location))
        );
      }),
    sort,
  );
  const carried = visible.filter(
    ({ item }) =>
      equipmentIsOwned(item) && defaultCarryState(item) !== "cached",
  );
  const stored = visible.filter(
    ({ item }) =>
      equipmentIsOwned(item) && defaultCarryState(item) === "cached",
  );
  const wishlist = visible.filter(({ item }) => !equipmentIsOwned(item));
  function add(entry: InventoryCatalogEntry) {
    if (entry.kind === "magic") props.onAddMagicItemFromTemplate(entry.id);
    else if (entry.kind === "armor") props.onAddArmorFromTemplate(entry.id);
    else if (entry.kind === "shield") props.onAddShieldFromTemplate(entry.id);
    else if (entry.kind === "weapon") {
      props.onAddWeapon();
      props.onApplyWeaponTemplate(build.weapons?.length ?? 0, entry.id);
    } else props.onAddEquipmentFromTemplate(entry.id);
    setNotice(
      `${entry.name} added. Manage ownership, location, and purchase from its item details.`,
    );
  }
  function list(title: string, entries: typeof visible) {
    return (
      <section className="v2-panel inventory-location-tile">
        <header className="v2-panel-heading">
          <h2>{title}</h2>
          <span className="v2-count">{entries.length}</span>
        </header>
        {!entries.length ? (
          <p className="v2-empty">
            {title === "Stored"
              ? "No items stored away. Set an item’s location to cached to keep it out of your carried load."
              : "No items here match your filters."}
          </p>
        ) : (
          groupGearEntries(entries, group).map((bucket) => (
            <div key={bucket.key}>
              {group !== "none" && (
                <h3 className="v2-group-label">{bucket.label}</h3>
              )}
              {bucket.entries.map(({ item, index }) => (
                <button
                  className="inventory-item-row"
                  key={index}
                  onClick={() => setTarget({ kind: "equipment", index })}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.equipped
                        ? "Equipped"
                        : defaultCarryState(item) === "stowed"
                          ? "Stowed in pack"
                          : item.containerName || item.slot || "Loose"}
                      {item.usesMax !== undefined
                        ? ` · ${item.usesRemaining ?? item.usesMax}/${item.usesMax} uses`
                        : ""}
                    </small>
                  </span>
                  <span>×{item.quantity ?? 1}</span>
                  <small>
                    {number((item.weight ?? 0) * (item.quantity ?? 1))} lb
                  </small>
                  <span>›</span>
                </button>
              ))}
            </div>
          ))
        )}
      </section>
    );
  }
  const weapons = sheet?.weapons ?? [];
  const packedWeapons = equipment
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item, index }) =>
        item.weapon &&
        equipmentIsOwned(item) &&
        defaultCarryState(item) !== "cached" &&
        !weapons.some(
          (weapon) =>
            weapon.sourceKind === "equipment" && weapon.sourceIndex === index,
        ),
    );
  return (
    <div
      className={`workspace-v2 inventory-workspace v2-rail-layout ${railOpen ? "" : "is-collapsed"}`}
    >
      <main className="v2-main">
        <section className="v2-panel inventory-money-strip">
          {(
            [
              ["pp", "Platinum"],
              ["gp", "Gold"],
              ["sp", "Silver"],
              ["cp", "Copper"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <small>{label}</small>
              <strong>{number(wealth[key])}</strong>
            </div>
          ))}
          <div>
            <small>Carried GP</small>
            <strong>
              {number(wealth.liquidWealthGp)} <em>gp</em>
            </strong>
          </div>
          <div>
            <small>Total Wealth</small>
            <strong>
              {number(wealth.totalWealthGp)} <em>gp</em>
            </strong>
          </div>
          <div>
            <small>Carried load</small>
            <strong>
              {number(sheet?.encumbrance.carriedWeight ?? 0)} <em>lb</em>
            </strong>
          </div>
          <button className="ghost small" onClick={() => setCoins(true)}>
            Edit coins
          </button>
        </section>
        <section className="v2-panel inventory-weapons">
          <header className="v2-panel-heading">
            <h2>Carried weapons</h2>
            <button
              className="ghost small"
              onClick={() => {
                setScope("catalog");
                setKind("weapon");
                setSlot("");
                setLocation("");
                setRailOpen(true);
                setQuery("");
              }}
            >
              + Add weapon
            </button>
          </header>
          <div className="inventory-weapon-table">
            <div className="inventory-weapon-head">
              <span>Weapon</span>
              <span>Ready</span>
              <span>Attack</span>
              <span>Damage / type</span>
              <span>Ammunition</span>
              <span />
            </div>
            {weapons.map((weapon, index) => (
              <div
                className="inventory-weapon-row"
                key={`${weapon.name}-${index}`}
              >
                <strong>{weapon.name}</strong>
                <small>
                  {weapon.sourceKind === "race"
                    ? "Natural"
                    : weapon.sourceKind === "equipment"
                      ? "Equipped"
                      : "Ready"}
                </small>
                <b>{sign(weapon.attack.total)}</b>
                <span>
                  {weapon.damageDisplay}
                  <small>{weapon.damageTypes?.join(" / ")}</small>
                </span>
                <span>
                  {weapon.ammoType
                    ? `${weapon.loadedAmmoType || weapon.ammoType} · ${(weapon.ammoAvailability ?? []).map((entry) => entry.available).join(" / ") || "0"}`
                    : "—"}
                </span>
                <button
                  className="ghost small"
                  onClick={() => {
                    if (weapon.sourceKind !== "race")
                      setTarget({
                        kind:
                          weapon.sourceKind === "equipment"
                            ? "equipment"
                            : "weapon",
                        index: weapon.sourceIndex ?? index,
                      });
                  }}
                  disabled={weapon.sourceKind === "race"}
                >
                  Manage
                </button>
              </div>
            ))}
            {packedWeapons.map(({ item, index }) => (
              <div className="inventory-weapon-row" key={`packed-${index}`}>
                <strong>{item.name}</strong>
                <small>Not equipped</small>
                <b>—</b>
                <span>
                  {item.weapon?.damageDice}
                  <small>{item.weapon?.damageTypes?.join(" / ")}</small>
                </span>
                <span>
                  {item.weapon?.loadedAmmoType || item.weapon?.ammoType || "—"}
                </span>
                <button
                  className="ghost small"
                  onClick={() => setTarget({ kind: "equipment", index })}
                >
                  Manage
                </button>
              </div>
            ))}
            {!weapons.length && !packedWeapons.length && (
              <p className="v2-empty">
                No carried weapons yet. Add a weapon from the inventory catalog.
              </p>
            )}
          </div>
        </section>
        <div className="inventory-body-layout">
          <section className="v2-panel inventory-equipment-focus">
            <header className="v2-panel-heading">
              <div>
                <span className="character-eyebrow">Equipped now</span>
                <h2>Equipment</h2>
              </div>
              <small>Select a slot to manage it</small>
            </header>
            <EquipmentSilhouette
              equippedSlots={equippedSlots}
              onSelectSlot={(selectedSlot, _name, slotIndex = 0) => {
                const index =
                  equipment
                    .map((item, index) => ({ item, index }))
                    .filter(
                      ({ item }) =>
                        equipmentIsOwned(item) &&
                        item.equipped &&
                        item.slot === selectedSlot,
                    )[slotIndex]?.index ?? -1;
                if (index >= 0) setTarget({ kind: "equipment", index });
                else {
                  setSlot(selectedSlot);
                  setScope("catalog");
                  setKind("");
                  setRailOpen(true);
                }
              }}
            />
          </section>
          <div className="inventory-location-lists">
            {list("Carried", carried)}
            {list("Stored", stored)}
            {wishlist.length > 0 && list("Wishlist", wishlist)}
          </div>
        </div>
        <details className="v2-panel v2-audit">
          <summary>
            Inventory checks & tools{" "}
            <span>{sheet?.inventory.itemCount ?? equipment.length} items</span>
          </summary>
          <p>
            Coin weight: {number(wealth.coinWeightLb)} lb · Equipment value:{" "}
            {number(wealth.gearCostGp)} gp · Wishlist:{" "}
            {number(wealth.wishlistCostGp)} gp
          </p>
          <button
            className="ghost small"
            onClick={() => setTarget({ kind: "overview" })}
          >
            Load, containers, ammunition & warnings
          </button>
        </details>
      </main>
      <aside className="v2-search-rail" aria-label="Inventory search">
        <header>
          <div>
            {railOpen && (
              <>
                <span className="character-eyebrow">Find & manage</span>
                <h2>Inventory</h2>
              </>
            )}
          </div>
          <button
            className="ghost"
            aria-label={
              railOpen ? "Collapse inventory search" : "Expand inventory search"
            }
            aria-expanded={railOpen}
            onClick={() => setRailOpen(!railOpen)}
          >
            {railOpen ? "›" : "‹"}
          </button>
        </header>
        {railOpen && (
          <>
            <div className="v2-segmented">
              <button
                aria-pressed={scope === "owned"}
                onClick={() => setScope("owned")}
              >
                My inventory
              </button>
              <button
                aria-pressed={scope === "catalog"}
                onClick={() => setScope("catalog")}
              >
                Add from catalog
              </button>
            </div>
            <label>
              Search
              <input
                type="search"
                aria-label="Search inventory"
                placeholder="Item, slot, container…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Type
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All item types</option>
                {["weapon", "armor", "shield", "magic", "mundane"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Slot
              <select
                value={slot}
                onChange={(event) => {
                  setSlot(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All slots</option>
                {EQUIPMENT_SLOTS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {scope === "owned" ? (
              <>
                <details className="inventory-extra-filters">
                  <summary>Ownership & components</summary>
                  <label>
                    Ownership
                    <select
                      value={ownership}
                      onChange={(event) => setOwnership(event.target.value)}
                    >
                      <option value="">All items</option>
                      <option value="owned">Owned</option>
                      <option value="wishlist">Wishlist</option>
                    </select>
                  </label>
                  <label>
                    Usage
                    <select
                      value={usage}
                      onChange={(event) => setUsage(event.target.value)}
                    >
                      <option value="">All usages</option>
                      {[
                        "ammo",
                        "material",
                        "focus",
                        "divine-focus",
                        "spellbook",
                        "kit",
                        "other",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </details>
                <label>
                  Location
                  <select
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  >
                    <option value="">All locations</option>
                    <option value="carried">Carried / equipped</option>
                    <option value="stowed">Stowed in pack</option>
                    <option value="cached">Stored away</option>
                    <option value="wishlist">Wishlist</option>
                  </select>
                </label>
                <label>
                  Sort
                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as GearSortMode)
                    }
                  >
                    {[
                      "manual",
                      "name",
                      "equipped",
                      "quantity",
                      "weight",
                      "cost",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Group within location
                  <select
                    value={group}
                    onChange={(event) =>
                      setGroup(event.target.value as GearGroupMode)
                    }
                  >
                    {["none", "carry-state", "slot", "usage", "container"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
              </>
            ) : (
              <>
                <small>
                  {results.length} catalog matches · all equipment in one place
                </small>
                <div className="v2-catalog-results">
                  {results
                    .slice(currentPage * 30, (currentPage + 1) * 30)
                    .map((entry) => (
                      <article key={`${entry.kind}-${entry.id}`}>
                        <span className="character-eyebrow">
                          {entry.kind}{" "}
                          {entry.cost !== undefined
                            ? `· ${number(entry.cost)} gp`
                            : ""}
                        </span>
                        <strong>{entry.name}</strong>
                        <p>{entry.detail}</p>
                        <small>{entry.source}</small>
                        <button
                          className="ghost small"
                          onClick={() => add(entry)}
                        >
                          + Add
                        </button>
                      </article>
                    ))}
                </div>
                <div className="v2-pagination">
                  <button
                    disabled={!currentPage}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    ‹
                  </button>
                  <small>
                    {currentPage + 1} / {pages}
                  </small>
                  <button
                    disabled={currentPage >= pages - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    ›
                  </button>
                </div>
              </>
            )}
            <button
              className="ghost small"
              onClick={() => {
                setQuery("");
                setKind("");
                setSlot("");
                setLocation("");
                setUsage("");
                setOwnership("");
                setGroup("none");
                setSort("manual");
              }}
            >
              Reset filters
            </button>
            <div className="v2-callout">
              <strong>{sheet?.encumbrance.band ?? "Load"} load</strong>
              <p>Stored-away items do not count against your carried weight.</p>
            </div>
            <details>
              <summary>Custom items</summary>
              <div className="v2-stack">
                <button
                  onClick={() => {
                    props.onAddEquipment();
                    setTarget({ kind: "equipment", index: equipment.length });
                  }}
                >
                  + Custom equipment
                </button>
                <button
                  onClick={() => {
                    props.onAddMagicItem();
                    setTarget({ kind: "equipment", index: equipment.length });
                  }}
                >
                  + Custom magic item
                </button>
                <button
                  onClick={() => {
                    props.onAddWeapon();
                    setTarget({
                      kind: "weapon",
                      index: build.weapons?.length ?? 0,
                    });
                  }}
                >
                  + Custom weapon
                </button>
              </div>
            </details>
            <p role="status">{notice}</p>
          </>
        )}
      </aside>
      {target && (
        <CharacterDialog
          label="Manage inventory"
          saveOnExit
          onClose={() => setTarget(null)}
        >
          <section className="modal v2-editor-dialog">
            <header className="modal-head">
              <div>
                <span className="character-eyebrow">Inventory details</span>
                <h2>
                  {target.kind === "overview"
                    ? "Inventory tools"
                    : target.kind === "weapon"
                      ? build.weapons?.[target.index]?.name
                      : equipment[target.index]?.name}
                </h2>
              </div>
              <button className="ghost" onClick={() => setTarget(null)}>
                Done
              </button>
            </header>
            {props.renderEditor(target, () => setTarget(null))}
          </section>
        </CharacterDialog>
      )}
      {coins && (
        <CharacterDialog
          label="Edit Coin Purse"
          saveOnExit
          onClose={() => setCoins(false)}
        >
          <section className="modal v2-coin-dialog">
            <header className="modal-head">
              <h2>Coin Purse</h2>
              <button className="ghost" onClick={() => setCoins(false)}>
                Done
              </button>
            </header>
            <div className="v2-four-fields">
              {(["pp", "gp", "sp", "cp"] as const).map((key) => (
                <label key={key}>
                  {key.toUpperCase()}
                  <input
                    type="number"
                    min={0}
                    value={wealth[key]}
                    onChange={(event) =>
                      props.onUpdateCoinPurse(
                        key,
                        Math.max(0, Number(event.target.value) || 0),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <section className="coin-calculator" aria-label="Coin calculator">
              <div className="sheet-panel-heading">
                <h3>Adjust purse</h3>
                <span>
                  {number(wealth.liquidWealthGp)} GP ·{" "}
                  {number(wealth.coinWeightLb)} lb
                </span>
              </div>
              <div className="coin-calculator-actions">
                <label className="field">
                  Amount in GP
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={coinAmount}
                    placeholder="0.00"
                    onChange={(event) => setCoinAmount(event.target.value)}
                  />
                </label>
                <button
                  disabled={!validAmount}
                  onClick={() => {
                    props.onAdjustCoinPurse(amountGp);
                    setCoinAmount("");
                  }}
                >
                  Add GP
                </button>
                <button
                  className="ghost"
                  disabled={
                    !validAmount ||
                    Math.round(amountGp * 100) >
                      Math.round(wealth.liquidWealthGp * 100)
                  }
                  onClick={() => {
                    props.onAdjustCoinPurse(-amountGp);
                    setCoinAmount("");
                  }}
                >
                  Subtract GP
                </button>
              </div>
              <p className="hint">
                Makes change using the fewest coins: platinum, gold, silver,
                then copper. Rounded to the nearest copper.
              </p>
              {validAmount && amountGp > wealth.liquidWealthGp && (
                <p className="hint">Not enough GP to subtract this amount.</p>
              )}
            </section>
            <label>
              <input
                type="checkbox"
                checked={build.coinWeightCountsTowardEncumbrance ?? true}
                onChange={(event) =>
                  props.onUpdateCoinWeightCountsTowardEncumbrance(
                    event.target.checked,
                  )
                }
              />{" "}
              Count coin weight toward encumbrance
            </label>
          </section>
        </CharacterDialog>
      )}
    </div>
  );
}
