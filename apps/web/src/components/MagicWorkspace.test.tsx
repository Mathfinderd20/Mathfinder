import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildCharacter,
  computeSheet,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import {
  MagicWorkspace,
  canReplacePreparation,
  preparationCopiesAvailable,
  spellGrantLabels,
} from "./MagicWorkspace";
import type { SpellcastingManagerProps } from "./SpellcastingManager";

const view = vi.hoisted(() => ({ value: "library" }));
vi.mock("../spellLabels", () => ({
  displaySpellName: (name: string) => name,
  displayDomainNames: (names: string[]) => names,
}));
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
  it("uses the class zero-level label and shows unlimited casting after enforcing preparations", () => {
    view.value = "ready";
    const props = propsFor("Cleric"),
      caster = props.casters[0]!;
    caster.selectedPreparedSpells = {
      0: ["Guidance", "Light", "Stabilize"],
    };
    caster.selectionDiagnostics = {
      0: caster.selectionDiagnostics[0],
    };
    caster.spellsPerDay = { 0: 3 };
    caster.slotsRemaining = { 0: 3 };
    caster.slotsUsed = { 0: 0 };
    const html = renderToStaticMarkup(<MagicWorkspace {...props} />);
    expect(html).toContain("Orisons");
    expect(html).toContain("3 / 3");
    expect(html).toContain("unlimited casts");
  });

  it("shows Domain badges for unprepared off-list spells and enforces the reserved slot", () => {
    view.value = "library";
    const props = propsFor("Cleric"),
      caster = props.casters[0]!;
    caster.domains = ["travel"];
    caster.grantedSpells = { 1: ["Longstrider"] };
    caster.librarySpells[1] = ["Longstrider", "Bless"];
    caster.restrictedOnlySpells = { 1: ["Longstrider"] };
    caster.selectionDiagnostics[1]!.restrictedSlotCapacity = 1;
    caster.selectionDiagnostics[1]!.restrictedSlotEligibleSpellNames = [
      "Longstrider",
    ];
    const html = renderToStaticMarkup(<MagicWorkspace {...props} />);
    expect(html).toContain('title="Travel domain"');
    expect(html).toContain('aria-label="Open Longstrider spell description"');
    expect(preparationCopiesAvailable(caster, 1, "Longstrider")).toBe(1);
    caster.selectedPreparedSpells[1] = ["Longstrider", "Bless"];
    expect(preparationCopiesAvailable(caster, 1, "Longstrider")).toBe(0);
    expect(canReplacePreparation(caster, 1, 1, "Longstrider")).toBe(false);
  });

  it("offers both domains at each level but reserves only one shared domain preparation", () => {
    view.value = "library";
    const props = propsFor("Cleric"),
      caster = props.casters[0]!;
    caster.domains = ["good", "protection"];
    caster.grantedSpells = {
      1: ["Protection from Evil", "Sanctuary"],
    };
    caster.librarySpells[1] = ["Protection from Evil", "Sanctuary", "Bless"];
    caster.selectionDiagnostics[1]!.restrictedSlotCapacity = 1;
    caster.selectionDiagnostics[1]!.restrictedSlotEligibleSpellNames = [
      "Protection from Evil",
      "Sanctuary",
    ];
    const html = renderToStaticMarkup(<MagicWorkspace {...props} />);
    expect(html).toContain('title="Good domain"');
    expect(html).toContain('title="Protection domain"');
    expect(preparationCopiesAvailable(caster, 1, "Protection from Evil")).toBe(
      1,
    );
    expect(preparationCopiesAvailable(caster, 1, "Sanctuary")).toBe(1);
    caster.selectedPreparedSpells[1] = ["Protection from Evil"];
    expect(preparationCopiesAvailable(caster, 1, "Sanctuary")).toBe(0);
  });

  it("renders an ability-gated cleric level as 0 / 0 plus its domain slot", () => {
    view.value = "ready";
    const props = propsFor("Cleric"),
      caster = props.casters[0]!;
    caster.domains = ["good", "protection"];
    caster.grantedSpells = {
      1: ["Protection from Evil", "Sanctuary"],
    };
    caster.selectedPreparedSpells = { 1: ["Protection from Evil"] };
    caster.spellsPerDay = { 1: 1 };
    caster.slotsRemaining = { 1: 1 };
    caster.slotsUsed = { 1: 0 };
    caster.selectionDiagnostics = {
      1: {
        ...caster.selectionDiagnostics[1]!,
        capacity: 1,
        meetsCastingAbility: false,
        canCastLevel: true,
        restrictedSlotCapacity: 1,
        restrictedSlotEligibleSpellNames: ["Protection from Evil", "Sanctuary"],
        restrictedSlotEligibleSelectedCount: 1,
      },
    };
    const html = renderToStaticMarkup(<MagicWorkspace {...props} />);
    expect(html).toContain("0 / 0 +1");
    expect(html).toContain("1 domain prepared");
  });

  it("shows bloodline spells in both library and ready views with an enabled Cast action, not Learn", () => {
    const props = propsFor("Sorcerer"),
      caster = props.casters[0]!;
    caster.bloodline = "arcane";
    caster.grantedSpells = { 1: ["Identify"] };
    caster.librarySpells = { 1: ["Identify"] };
    caster.selectedKnownSpells = {};
    expect(spellGrantLabels(caster, 1, "Identify")).toEqual([
      { kind: "Bloodline", source: "Arcane", note: undefined },
    ]);
    for (const tab of ["library", "ready"]) {
      view.value = tab;
      const html = renderToStaticMarkup(<MagicWorkspace {...props} />);
      expect(html).toContain('aria-label="Open Identify spell description"');
      expect(html).toContain('title="Arcane bloodline"');
      expect(html).toContain('<button class="ghost small">Cast</button>');
      expect(html).not.toContain(">Learn</button>");
      expect(html).not.toContain("Bonus known");
    }
  });
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
