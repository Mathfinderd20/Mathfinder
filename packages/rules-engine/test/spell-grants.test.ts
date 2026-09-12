import { afterEach, describe, expect, it } from "vitest";
import {
  BLOODLINES,
  DOMAINS,
  buildCharacter,
  computeSheet,
  configureBloodlineCatalog,
  configureDomainCatalog,
  grantedBloodlineSpells,
  selectedBloodline,
  validateBuild,
  type CharacterBuild,
  type SpellRegistry,
} from "../src";

const registry: SpellRegistry = Object.fromEntries(
  [
    ["Longstrider", "Druid", 1],
    ["Identify", "Sorcerer", 1],
    ["Invisibility", "Sorcerer", 2],
    ["Entangle", "Druid", 1],
    ["Magic Missile", "Sorcerer", 1],
    ["Shield", "Sorcerer", 1],
    ["Charm Person", "Sorcerer", 1],
  ].map(([name, className, level]) => [
    String(name).toLowerCase(),
    {
      id: String(name),
      name: String(name),
      pack: "test",
      classes: [{ className: String(className), level: Number(level) }],
    },
  ]),
);
function character(className: string, level: number): CharacterBuild {
  return {
    name: "Grant test",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 20, wis: 20, cha: 20 },
    levels: Array.from({ length: level }, () => ({
      className,
      hitPointRoll: 6,
    })),
  };
}
const derive = (build: CharacterBuild) =>
  computeSheet(buildCharacter(build), { spellRegistry: registry }).spellcasting;
afterEach(() => {
  configureDomainCatalog([], true);
  configureBloodlineCatalog([], true);
});
describe("source-granted spell libraries", () => {
  it("adds unlocked off-list domain spells without preparing them or leaking into another class", () => {
    const build = character("Cleric", 3);
    build.levels.push({ className: "Wizard", hitPointRoll: 6 });
    build.spellDomains = { cleric: ["travel", "good"] };
    const casters = derive(build),
      cleric = casters.find((c) => c.className === "Cleric")!;
    expect(cleric.librarySpells[1]).toContain("Longstrider");
    expect(cleric.grantedSpells[2]).toContain("Align Weapon");
    expect(cleric.grantedSpells[3]).toBeUndefined();
    expect(cleric.selectedPreparedSpells).toEqual({});
    expect(
      casters.find((c) => c.className === "Wizard")!.grantedSpells,
    ).toEqual({});
    build.spellSelections = { cleric: { prepared: { 1: ["Longstrider"] } } };
    expect(derive(build)[0]!.selectionDiagnostics[1]!.offListSpells).toEqual(
      [],
    );
    build.spellSelections.cleric!.prepared![1]!.push("Longstrider");
    expect(
      derive(build)[0]!.selectionDiagnostics[1]!.restrictedSlotShortfall,
    ).toBe(1);
    expect(() => validateBuild(build)).not.toThrow();
  });
  it("gates bonus known spells at sorcerer levels 3, 5, through 19 without increasing daily slots", () => {
    expect(grantedBloodlineSpells("arcane", 2)).toEqual({});
    expect(grantedBloodlineSpells("arcane", 3)).toEqual({ 1: ["Identify"] });
    expect(grantedBloodlineSpells("arcane", 5)).toEqual({
      1: ["Identify"],
      2: ["Invisibility"],
    });
    expect(Object.keys(grantedBloodlineSpells("arcane", 19))).toHaveLength(9);
    const build = character("Sorcerer", 3),
      ordinary = derive(build)[0]!;
    build.spellBloodlines = { sorcerer: "arcane" };
    build.spellSelections = {
      sorcerer: {
        known: { 1: ["Magic Missile", "Shield", "Charm Person", "Identify"] },
      },
    };
    const caster = derive(build)[0]!;
    expect(caster.librarySpells[1]).toContain("Identify");
    expect(caster.selectionDiagnostics[1]).toMatchObject({
      selectedCount: 3,
      overCapacity: false,
    });
    expect(caster.spellsPerDay).toEqual(ordinary.spellsPerDay);
    expect(build.spellLibrary).toBeUndefined();
    build.spellBloodlines.sorcerer = "fey";
    expect(derive(build)[0]!.grantedSpells[1]).toEqual(["Entangle"]);
  });
  it("recognizes legacy bloodline choices but permits explicit removal and never guesses", () => {
    const build = character("Sorcerer", 5);
    expect(selectedBloodline(build)).toBeUndefined();
    build.levels[0]!.features = ["Bloodline: Arcane"];
    expect(selectedBloodline(build)).toBe("arcane");
    build.spellBloodlines = { sorcerer: "" };
    expect(selectedBloodline(build)).toBeUndefined();
  });
  it("uses reviewed catalog grants without reintroducing legacy content", () => {
    configureDomainCatalog([
      {
        id: "custom",
        name: "Custom",
        className: "cleric",
        spells: { 1: "Longstrider" },
      },
    ]);
    configureBloodlineCatalog([
      { id: "custom", name: "Custom", bonusSpells: ["Identify"] },
    ]);
    expect(Object.keys(DOMAINS)).toEqual(["custom"]);
    expect(Object.keys(BLOODLINES)).toEqual(["custom"]);
    expect(grantedBloodlineSpells("custom", 3)).toEqual({ 1: ["Identify"] });
  });
});
