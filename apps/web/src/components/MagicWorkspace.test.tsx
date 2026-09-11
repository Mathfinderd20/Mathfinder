import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import { MagicWorkspace, canReplacePreparation } from "./MagicWorkspace";
import type { SpellcastingManagerProps } from "./SpellcastingManager";

const view = vi.hoisted(() => ({ value: "library" }));
vi.mock("../features/characters/CharacterUiSession", () => ({
  useCharacterUiState: (_id: string, key: string, initial: unknown) => [
    key === "magic-view" ? view.value : initial,
    vi.fn(),
  ],
}));

function propsFor(className: string): SpellcastingManagerProps {
  const build: CharacterBuild = {
    name: "Library test",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 18, wis: 18, cha: 18 },
    levels: [{ className, hitPointRoll: 6 }],
    spellLibrary: { [className.toLowerCase()]: { 1: ["Special Item Spell"] } },
  };
  return {
    casters: computeSheet(buildCharacter(build)).spellcasting,
    spellOptions: [],
    domainOptions: [],
    schoolOptions: [],
    spellCastCounts: {},
    spellSuggestions: {},
    onAddSelection: vi.fn(),
    onAppendSelection: vi.fn(),
    onUpdateSelectionName: vi.fn(),
    onRemoveSelection: vi.fn(),
    onResetSelectionsForLevel: vi.fn(),
    onResetSelectionsForClass: vi.fn(),
    onAddLibraryEntry: vi.fn(),
    onAppendLibraryEntry: vi.fn(),
    onUpdateLibraryName: vi.fn(),
    onRemoveLibraryEntry: vi.fn(),
    onResetLibraryLevel: vi.fn(),
    onResetLibraryForClass: vi.fn(),
    onFillSelectionsFromLibrary: vi.fn(),
    onUpdateDomains: vi.fn(),
    onUpdateSpecialization: vi.fn(),
    onAdjustExtraSpellSlots: vi.fn(),
    onAdjustSpellSlot: vi.fn(),
    onCastSpell: vi.fn(),
    onResetSpellSlotLevel: vi.fn(),
    onResetSpellRuntimeClass: vi.fn(),
  };
}

describe("Magic tab class libraries", () => {
  it("shows automatically available cleric spells and manual grants in the spell library", () => {
    view.value = "library";
    const html = renderToStaticMarkup(
      <MagicWorkspace {...propsFor("Cleric")} />,
    );
    expect(html).toContain('aria-label="Open Bless spell description"');
    expect(html).toContain(
      'aria-label="Open Special Item Spell spell description"',
    );
    expect(html).not.toContain('aria-label="Open Aid spell description"');
    expect(html).toContain(
      "Your library automatically includes your class spells",
    );
  });

  it("does not mark the cleric's entire library as prepared", () => {
    view.value = "ready";
    const html = renderToStaticMarkup(
      <MagicWorkspace {...propsFor("Cleric")} />,
    );
    expect(html).not.toContain('aria-label="Open Bless spell description"');
  });

  it.each(["Wizard", "Sorcerer"])(
    "only shows acquired spells for %s",
    (className) => {
      view.value = "library";
      const html = renderToStaticMarkup(
        <MagicWorkspace {...propsFor(className)} />,
      );
      expect(html).toContain(
        'aria-label="Open Special Item Spell spell description"',
      );
      expect(html).not.toContain(
        'aria-label="Open Magic Missile spell description"',
      );
    },
  );

  it("allows replacement with an automatic cleric spell without manually adding it first", () => {
    const caster = propsFor("Cleric").casters[0]!;
    caster.selectedPreparedSpells = { 1: ["Shield of Faith"] };
    expect(canReplacePreparation(caster, 1, 0, "Bless")).toBe(true);
    expect(canReplacePreparation(caster, 1, 0, "Magic Missile")).toBe(false);
  });
});
