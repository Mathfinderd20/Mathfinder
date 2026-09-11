import { describe, expect, it } from "vitest";
import type {
  CharacterBuild,
  DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import { appendSelectionToBuild } from "./app/useSpellbookEditor";
import {
  filterInventoryCatalog,
  type InventoryCatalogEntry,
} from "./components/InventoryWorkspace";
import { buildClassProgression } from "./components/BuildWorkspace";
import {
  canReplacePreparation,
  compactSpellComponents,
  spellPreparationRoom,
  primarySpellSchool,
  spellRowSaveDc,
} from "./components/MagicWorkspace";
import { filterCharacterNotes } from "./features/characters/CharacterNotebook";

const build: CharacterBuild = {
  name: "Workspace test",
  race: { name: "Human", size: "medium", speed: 30 },
  baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 16, cha: 10 },
  levels: [{ className: "Cleric", hitPointRoll: 8 }],
};
function caster(spells: string[]): DerivedSpellcasting {
  return {
    className: "Cleric",
    castingType: "prepared",
    spellAccess: "full-list",
    castingAbility: "wis",
    castingAbilityScore: 16,
    maxCastableSpellLevel: 1,
    maxSpellLevel: 1,
    casterLevel: 1,
    domains: ["healing"],
    concentration: { total: 4, breakdown: [] },
    baseSpellsPerDay: { 1: 1 },
    bonusSpellsPerDay: { 1: 1 },
    extraSlotsPerDay: {},
    restrictedExtraSlotsPerDay: { 1: 1 },
    spellsPerDay: { 1: 3 },
    spellsKnown: {},
    preparedCapacity: { 1: 3 },
    grantedSpells: { 1: ["Cure Light Wounds", "Bless"] },
    librarySpells: { 1: ["Shield of Faith", "Command"] },
    manualLibrarySpells: { 1: ["Shield of Faith", "Command"] },
    selectedPreparedSpells: { 1: spells },
    selectedKnownSpells: {},
    slotsUsed: { 1: 0 },
    slotsRemaining: { 1: 3 },
    spellSaveDcs: { 1: 14 },
    spellSaveDcBonusesBySchool: {},
    selectionDiagnostics: {
      1: {
        mode: "prepared",
        level: 1,
        capacity: 3,
        selectedCount: spells.length,
        availableSpellNames: [],
        librarySpellNames: [],
        unknownSpells: [],
        offListSpells: [],
        wrongLevelSpells: [],
        missingFromLibrary: [],
        requiredAbilityScore: 11,
        canCastLevel: true,
        isAtWill: false,
        overCapacity: false,
        restrictedSlotCapacity: 1,
        restrictedSlotEligibleSpellNames: ["Cure Light Wounds", "Bless"],
        restrictedSlotEligibleSelectedCount: 0,
        restrictedSlotShortfall: 0,
      },
    },
  };
}

describe("mock-aligned workspace workflows", () => {
  it("adds several preparations in one update without overwriting another casting source", () => {
    const original = {
      ...build,
      spellSelections: { wizard: { prepared: { 1: ["Shield"] } } },
    };
    const updated = appendSelectionToBuild(
      original,
      "cleric",
      "prepared",
      1,
      " Command ",
      3,
    );
    expect(updated.spellSelections?.cleric?.prepared?.[1]).toEqual([
      "Command",
      "Command",
      "Command",
    ]);
    expect(updated.spellSelections?.wizard?.prepared?.[1]).toEqual(["Shield"]);
    expect(original.spellSelections).not.toHaveProperty("cleric");
    expect(
      appendSelectionToBuild(updated, "cleric", "prepared", 1, "Bless")
        .spellSelections?.cleric?.prepared?.[1],
    ).toHaveLength(4);
  });
  it("deduplicates known spells and rejects invalid copy counts", () => {
    const first = appendSelectionToBuild(
      build,
      "sorcerer",
      "known",
      1,
      "Shield",
      3,
    );
    expect(first.spellSelections?.sorcerer?.known?.[1]).toEqual(["Shield"]);
    expect(
      appendSelectionToBuild(first, "sorcerer", "known", 1, "shield"),
    ).toBe(first);
    expect(appendSelectionToBuild(build, "cleric", "prepared", 1, "", 1)).toBe(
      build,
    );
    expect(
      appendSelectionToBuild(build, "cleric", "prepared", 1, "Bless", NaN),
    ).toBe(build);
  });
  it("reserves domain capacity when all normal preparations are filled", () => {
    expect(
      spellPreparationRoom(caster(["Command", "Shield of Faith"]), 1),
    ).toEqual({ total: 1, restricted: 1, normal: 0 });
    expect(spellPreparationRoom(caster(["Cure Light Wounds"]), 1)).toEqual({
      total: 2,
      restricted: 0,
      normal: 2,
    });
    expect(
      spellPreparationRoom(caster(["Cure Light Wounds", "Bless"]), 1),
    ).toEqual({ total: 1, restricted: 0, normal: 1 });
  });
  it("does not trade the last domain preparation for a normal spell", () => {
    const source = caster(["Cure Light Wounds", "Command", "Shield of Faith"]);
    expect(canReplacePreparation(source, 1, 0, "Bless")).toBe(true);
    expect(canReplacePreparation(source, 1, 0, "Command")).toBe(false);
    expect(canReplacePreparation(source, 1, 1, "Shield of Faith")).toBe(true);
    expect(canReplacePreparation(source, 1, 1, "Unknown Spell")).toBe(false);
    expect(canReplacePreparation(source, 1, 4, "Bless")).toBe(false);
  });
  it("allows replacing a spare eligible spell but not casting at an unavailable level", () => {
    const source = caster(["Cure Light Wounds", "Bless"]);
    expect(canReplacePreparation(source, 1, 0, "Command")).toBe(true);
    source.selectionDiagnostics[1]!.canCastLevel = false;
    expect(canReplacePreparation(source, 1, 0, "Command")).toBe(false);
  });
  it("keeps component initials compact without splitting material descriptions", () => {
    expect(
      compactSpellComponents("V, S, M (a pinch of salt, silver dust), DF"),
    ).toBe("V, S, M, DF");
    expect(compactSpellComponents(undefined)).toBe("—");
  });
  it("includes school bonuses for scraped school names with subschools and descriptors", () => {
    const source = caster([]);
    source.spellSaveDcBonusesBySchool.conjuration = {
      total: 1,
      breakdown: [{ source: "Spell Focus", type: "untyped", value: 1 }],
    };
    expect(primarySpellSchool("Conjuration(healing) [good]")).toBe(
      "conjuration",
    );
    expect(spellRowSaveDc(source, 1, "Conjuration(healing) [good]")).toBe(15);
    expect(spellRowSaveDc(source, 2, "Conjuration(healing)")).toBeUndefined();
    expect(spellRowSaveDc(source, 1, "Evocation [fire]")).toBe(14);
  });
  it("searches magic and mundane equipment together and applies slot filters", () => {
    const entries: InventoryCatalogEntry[] = [
      {
        id: "a",
        name: "Belt of Strength",
        kind: "magic",
        slot: "belt",
        detail: "Enhancement bonus",
        source: "Core",
      },
      {
        id: "b",
        name: "Rope",
        kind: "mundane",
        detail: "50 feet",
        source: "Core",
      },
      {
        id: "c",
        name: "Chain shirt",
        kind: "armor",
        slot: "armor",
        detail: "AC +4",
      },
    ];
    expect(
      filterInventoryCatalog(entries, "core", "", "").map((entry) => entry.id),
    ).toEqual(["a", "b"]);
    expect(
      filterInventoryCatalog(entries, "belt core", "magic", "belt"),
    ).toHaveLength(1);
    expect(filterInventoryCatalog(entries, "rope", "magic", "")).toHaveLength(
      0,
    );
    expect(entries[0]?.id).toBe("a");
  });
  it("indexes notes by title, category and body with pinned notes first", () => {
    const notes = [
      {
        id: "1",
        title: "A clue",
        category: "Session",
        body: "Silver door",
        pinned: false,
      },
      {
        id: "2",
        title: "Z ally",
        category: "People",
        body: "Silver key",
        pinned: true,
      },
    ];
    expect(
      filterCharacterNotes(notes, "silver").map((note) => note.id),
    ).toEqual(["2", "1"]);
    expect(
      filterCharacterNotes(notes, "people").map((note) => note.id),
    ).toEqual(["2"]);
    expect(notes.map((note) => note.id)).toEqual(["1", "2"]);
  });
  it("tracks multiclass advancement in chronological order", () => {
    expect(
      buildClassProgression(
        ["Cleric", "Wizard", "Cleric", "Wizard", "Wizard"].map((className) => ({
          className,
          hitPointRoll: 5,
        })),
      ),
    ).toEqual([1, 1, 2, 2, 3]);
    expect(buildClassProgression([])).toEqual([]);
  });
});
