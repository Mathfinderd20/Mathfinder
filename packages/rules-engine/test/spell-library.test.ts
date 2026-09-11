import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  computeSheet,
  completeCoreSpellProgression,
  SAMPLE_CLASSES,
  validateBuild,
  type CharacterBuild,
  type SpellRegistry,
} from "../src";

function build(className: string, level = 1): CharacterBuild {
  return {
    name: "Library caster",
    race: { name: "Human", size: "medium", speed: 30 },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 20, wis: 20, cha: 20 },
    levels: Array.from({ length: level }, () => ({
      className,
      hitPointRoll: 6,
    })),
  };
}

const classes = [
  "Cleric",
  "Druid",
  "Ranger",
  "Paladin",
  "Wizard",
  "Sorcerer",
  "Inquisitor",
  "Bard",
];
const spellRegistry: SpellRegistry = Object.fromEntries(
  classes.flatMap((className) =>
    Array.from({ length: 10 }, (_, level) => {
      const name = `${className} Spell ${level}`;
      return [
        name.toLowerCase(),
        { id: name, name, pack: "test", classes: [{ className, level }] },
      ];
    }),
  ),
);
const derive = (character: CharacterBuild) =>
  computeSheet(buildCharacter(character), { spellRegistry }).spellcasting;

describe("automatic class spell libraries", () => {
  it("validates full-list preparations even when only a different spell was manually saved", () => {
    const character = build("Cleric");
    character.spellLibrary = { cleric: { 1: ["Cure Light Wounds"] } };
    character.spellSelections = { cleric: { prepared: { 1: ["Bless"] } } };
    expect(validateBuild(character).map((issue) => issue.code)).not.toContain(
      "spell-not-in-library",
    );
  });

  it.each(["Ranger", "Paladin"])(
    "validates one bonus-slot preparation for a fourth-level %s",
    (className) => {
      const character = build(className, 4);
      const key = className.toLowerCase();
      const name = className === "Ranger" ? "Gravity Bow" : "Bless Weapon";
      character.baseAbilityScores.wis = 14;
      character.baseAbilityScores.cha = 14;
      character.spellSelections = { [key]: { prepared: { 1: [name] } } };
      expect(validateBuild(character).map((issue) => issue.code)).not.toContain(
        "prepared-spells-over-capacity",
      );
      character.spellSelections[key]!.prepared![1]!.push(name);
      expect(validateBuild(character).map((issue) => issue.code)).toContain(
        "prepared-spells-over-capacity",
      );
    },
  );
  it.each(["Cleric", "Druid"])(
    "gives %s its complete unlocked runtime list without preparing it",
    (className) => {
      const character = build(className, 3);
      const caster = derive(character)[0]!;
      expect(caster.spellAccess).toBe("full-list");
      expect(caster.librarySpells).toEqual({
        0: [`${className} Spell 0`],
        1: [`${className} Spell 1`],
        2: [`${className} Spell 2`],
      });
      expect(caster.selectedPreparedSpells).toEqual({});
      expect(caster.manualLibrarySpells).toEqual({});
      expect(character.spellLibrary).toBeUndefined();
    },
  );

  it.each(["Cleric", "Druid"])(
    "updates %s access through level 20 and when levels are removed",
    (className) => {
      for (let level = 1; level <= 20; level++) {
        const caster = derive(build(className, level))[0]!;
        const highest = Math.min(9, Math.ceil(level / 2));
        expect(Object.keys(caster.librarySpells).map(Number)).toEqual(
          Array.from({ length: highest + 1 }, (_, n) => n),
        );
      }
      const character = build(className, 20);
      character.levels = character.levels.slice(0, 1);
      expect(Object.keys(derive(character)[0]!.librarySpells)).toEqual([
        "0",
        "1",
      ]);
    },
  );

  it.each(["Ranger", "Paladin"])(
    "unlocks %s spells at zero-base-slot levels, including bonus slots",
    (className) => {
      expect(derive(build(className, 3))[0]!.librarySpells).toEqual({});
      for (const [level, highest] of [
        [4, 1],
        [7, 2],
        [10, 3],
        [13, 4],
        [20, 4],
      ]) {
        const caster = derive(build(className, level))[0]!;
        expect(Object.keys(caster.librarySpells).map(Number)).toEqual(
          Array.from({ length: highest! }, (_, n) => n + 1),
        );
        expect(caster.spellsPerDay[highest!]).toBeGreaterThan(0);
      }
      const character = build(className, 4);
      character.baseAbilityScores.wis = 11;
      character.baseAbilityScores.cha = 11;
      const caster = derive(character)[0]!;
      expect(caster.librarySpells[1]).toEqual([`${className} Spell 1`]);
      expect(caster.spellsPerDay[1]).toBe(0);
    },
  );

  it("retains manual additions and canonicalizes automatic duplicates without changing editor indices", () => {
    const character = build("Cleric");
    character.spellLibrary = {
      cleric: { 1: ["Special Item Spell", "cleric spell 1"] },
    };
    character.spellSelections = {
      cleric: { prepared: { 1: ["Cleric Spell 1"] } },
    };
    const caster = derive(character)[0]!;
    expect(caster.librarySpells[1]).toEqual([
      "Cleric Spell 1",
      "Special Item Spell",
    ]);
    expect(caster.manualLibrarySpells[1]).toEqual([
      "Special Item Spell",
      "cleric spell 1",
    ]);
    expect(caster.selectionDiagnostics[1]!.missingFromLibrary).toEqual([]);
    expect(character.spellLibrary.cleric![1]).toEqual([
      "Special Item Spell",
      "cleric spell 1",
    ]);
  });

  it("does not unlock a whole spell level from domains, manual additions, preparations, or extra slots", () => {
    const character = build("Cleric");
    character.spellDomains = { cleric: ["good", "healing"] };
    character.spellLibrary = { cleric: { 7: ["Item Spell"] } };
    character.spellExtraSlots = { cleric: { 8: 1 } };
    character.spellSelections = {
      cleric: { prepared: { 9: ["Cleric Spell 9"] } },
    };
    const caster = derive(character)[0]!;
    expect(caster.librarySpells[7]).toEqual(["Item Spell"]);
    expect(caster.librarySpells[8]).toBeUndefined();
    expect(caster.librarySpells[9]).toBeUndefined();
    expect(Object.keys(caster.grantedSpells)).toEqual(["1"]);
    expect(caster.selectionDiagnostics[9]!.missingFromLibrary).toContain(
      "Cleric Spell 9",
    );
  });

  it("keeps a full-list caster's knowledge when ability damage prevents preparation", () => {
    const character = build("Cleric", 3);
    character.baseAbilityScores.wis = 11;
    const caster = derive(character)[0]!;
    expect(caster.librarySpells[2]).toEqual(["Cleric Spell 2"]);
    expect(caster.selectionDiagnostics[2]!.canCastLevel).toBe(false);
    expect(caster.spellsPerDay[2]).toBe(0);
  });

  it.each(["Wizard", "Sorcerer", "Inquisitor", "Bard"])(
    "does not automatically learn the %s list",
    (className) => {
      const character = build(className);
      expect(derive(character)[0]!.librarySpells).toEqual({});
      character.spellLibrary = {
        [className.toLowerCase()]: { 1: [`${className} Spell 1`] },
      };
      const caster = derive(character)[0]!;
      expect(caster.librarySpells).toEqual({ 1: [`${className} Spell 1`] });
      expect(caster.spellAccess).toBe(
        className === "Wizard" ? "spellbook" : "limited-known",
      );
      if (className !== "Wizard")
        expect(caster.selectionDiagnostics[1]!.capacity).toBeGreaterThan(0);
    },
  );

  it("keeps each multiclass library tied to its own class level and acquisition rules", () => {
    const character = build("Cleric", 3);
    character.levels.push(
      ...build("Wizard", 5).levels,
      ...build("Sorcerer", 4).levels,
    );
    const [cleric, wizard, sorcerer] = derive(character);
    expect(Object.keys(cleric!.librarySpells)).toEqual(["0", "1", "2"]);
    expect(wizard!.librarySpells).toEqual({});
    expect(sorcerer!.librarySpells).toEqual({});
  });

  it("supports legacy inputs and explicit spell-access overrides", () => {
    const input = buildCharacter(build("Cleric"));
    delete input.spellcasting![0]!.spellAccess;
    expect(
      computeSheet(input, { spellRegistry }).spellcasting[0]!.librarySpells[1],
    ).toEqual(["Cleric Spell 1"]);
    input.spellcasting![0]!.spellAccess = "spellbook";
    expect(
      computeSheet(input, { spellRegistry }).spellcasting[0]!.librarySpells,
    ).toEqual({});
    input.spellcasting![0]!.castingType = "spontaneous";
    delete input.spellcasting![0]!.spellAccess;
    expect(
      computeSheet(input, { spellRegistry }).spellcasting[0]!.spellAccess,
    ).toBe("limited-known");
  });

  it("repairs legacy divine tables while preserving explicit custom progressions", () => {
    const legacy = {
      ...SAMPLE_CLASSES.paladin!,
      spellcasting: {
        castingType: "prepared" as const,
        castingAbility: "cha" as const,
        spellsPerDay: { 4: { 3: 1 }, 5: { 3: 1 } },
      },
    };
    const updated = completeCoreSpellProgression(legacy).spellcasting!;
    expect(updated.spellAccess).toBe("full-list");
    expect(updated.spellsPerDay[4]).toEqual({ 1: 0 });
    expect(updated.spellsPerDay[5]).toEqual({ 1: 1 });
    expect(updated.spellsPerDay[20]).toEqual({ 1: 4, 2: 4, 3: 3, 4: 3 });
    expect(legacy.spellcasting.spellsPerDay[4]).toEqual({ 3: 1 });
    expect(
      completeCoreSpellProgression({
        ...legacy,
        spellcasting: { ...legacy.spellcasting, spellAccess: "spellbook" },
      }).spellcasting!.spellsPerDay[4],
    ).toEqual({ 3: 1 });
  });
});
