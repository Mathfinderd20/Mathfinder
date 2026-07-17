import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  type CharacterBuild,
  validateBuild,
} from "../src/build/character";
import { computeSheet } from "../src/compute";
import {
  MAGIC_ITEMS,
  equipmentMagicItemTemplate,
  getMagicItem,
} from "../src/content/magic-items";

describe("magic item templates", () => {
  it("exposes tiered upgrade chains for common wondrous items", () => {
    const belt2 = getMagicItem("belt-of-giant-strength-2");
    const belt4 = getMagicItem("belt-of-giant-strength-4");
    const belt6 = getMagicItem("belt-of-giant-strength-6");
    expect(belt2?.upgradeToId).toBe("belt-of-giant-strength-4");
    expect(belt4?.downgradeToId).toBe("belt-of-giant-strength-2");
    expect(belt4?.upgradeToId).toBe("belt-of-giant-strength-6");
    expect(belt6?.downgradeToId).toBe("belt-of-giant-strength-4");
  });

  it("applies templated slot and modifiers through buildCharacter/computeSheet", () => {
    const belt = getMagicItem("belt-of-giant-strength-4");
    expect(belt).toBeTruthy();
    const build: CharacterBuild = {
      name: "Grukk",
      race: {
        name: "Half-Orc",
        size: "medium",
        speed: 30,
        abilityModifiers: [
          { target: "str", type: "racial", value: 2, source: "Half-Orc" },
        ],
      },
      baseAbilityScores: {
        str: 14,
        dex: 13,
        con: 14,
        int: 10,
        wis: 12,
        cha: 8,
      },
      levels: [{ className: "Barbarian", hitPointRoll: 12 }],
      equipment: [{ ...equipmentMagicItemTemplate(belt!), equipped: true }],
    };
    const sheet = computeSheet(buildCharacter(build));
    expect(sheet.abilities.str.score).toBe(20);
    expect(sheet.inventoryItems[0]?.slot).toBe("belt");
  });

  it("includes compendium metadata and automation status", () => {
    const intelligence = getMagicItem("headband-of-vast-intelligence-2");
    const wizardry = getMagicItem("ring-of-wizardry-i");
    expect(intelligence?.source).toBe("Core Rulebook");
    expect(intelligence?.automation.status).toBe("partial");
    expect(intelligence?.automation.notes).toContain("granted-skill");
    expect(wizardry?.automation.status).toBe("manual");
    expect(wizardry?.tags).toContain("arcane");
  });

  it("covers every slotted magic item slot with catalog entries", () => {
    const slots = new Set(MAGIC_ITEMS.map((item) => item.slot));
    expect(slots).toEqual(
      new Set([
        "head",
        "eyes",
        "neck",
        "shoulders",
        "chest",
        "body",
        "torso",
        "belt",
        "wrists",
        "hands",
        "feet",
        "ring",
      ]),
    );
    expect(MAGIC_ITEMS.length).toBeGreaterThan(95);
    expect(getMagicItem("ring-of-sustenance")?.slot).toBe("ring");
    expect(getMagicItem("vest-of-escape")?.slot).toBe("chest");
    expect(getMagicItem("bracers-of-armor-8")?.modifiers[0]?.value).toBe(8);
  });

  it("respects slot-capacity validation for templated magic items", () => {
    const wisdom = getMagicItem("headband-of-inspired-wisdom-2");
    const intellect = getMagicItem("headband-of-vast-intelligence-2");
    const build: CharacterBuild = {
      name: "Too Many Hats",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Wizard", hitPointRoll: 6 }],
      equipment: [
        { ...equipmentMagicItemTemplate(wisdom!), equipped: true },
        { ...equipmentMagicItemTemplate(intellect!), equipped: true },
      ],
    };
    expect(validateBuild(build)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "equipment-slot-conflict" }),
      ]),
    );
  });
});
