import { describe, expect, it } from "vitest";
import {
  FEATS,
  type CharacterBuild,
  type FeatContext,
  type WeaponDefinition,
} from "@mathfinder/rules-engine";
import {
  buildFeatBaseEligibilityOptions,
  buildFeatPickerOptions,
  buildLooseFeatSearchOptions,
  collectFeatWeaponNames,
  collectFirearmNames,
  collectOwnedFirearmNames,
} from "./featOptionData";

const FEAT_CONTEXT: FeatContext = {
  baseAttackBonus: 1,
  abilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  characterLevel: 1,
  featNames: [],
};

describe("parameterized feat picker options", () => {
  it("collects owned and catalog firearms for Gun Training", () => {
    const build = {
      race: { name: "Human", size: "medium", speed: 30 },
      weapons: [
        { name: "Custom Service Rifle", firearmCategory: "two-handed" },
        { name: "Longsword" },
      ],
    } as CharacterBuild;
    expect(
      collectFirearmNames(build, [
        { id: "pistol", name: "Pistol", firearmCategory: "one-handed" },
        { id: "axe", name: "Axe" },
      ] as WeaponDefinition[]),
    ).toEqual(["Custom Service Rifle", "Pistol"]);
    expect(collectOwnedFirearmNames(build)).toEqual(["Custom Service Rifle"]);
  });

  it("does not eagerly expand parameterized feats for the creation modal", () => {
    const options = buildFeatBaseEligibilityOptions({
      featRegistry: FEATS,
      grantKind: "general",
      takenSelections: [],
    });

    expect(
      options.filter((option) => option.name === "Weapon Focus"),
    ).toHaveLength(1);
    expect(
      options.some((option) => option.name.startsWith("Weapon Focus (")),
    ).toBe(false);
  });

  it("puts the character's own guns before the global weapon catalog", () => {
    const build = {
      race: { name: "Human", size: "medium", speed: 30 },
      weapons: [{ name: "Adam's Custom Gun" }],
      equipment: [{ name: "Equipped Revolver", weapon: {} }],
    } as CharacterBuild;
    expect(
      collectFeatWeaponNames(build, [
        { id: "axe", name: "Axe" },
        { id: "sword", name: "Sword" },
      ] as WeaponDefinition[]),
    ).toEqual(["Adam's Custom Gun", "Equipped Revolver", "Axe", "Sword"]);
  });

  it("expands Weapon Focus choices for planner searches", () => {
    const options = buildLooseFeatSearchOptions({
      featRegistry: FEATS,
      grantKind: "fighter-bonus",
      availableWeaponNames: ["Longsword", "Musket"],
      query: "Weapon Focus",
    });

    expect(options.map((option) => option.name)).toEqual([
      "Weapon Focus (Longsword)",
      "Weapon Focus (Musket)",
    ]);
  });

  it("offers explicit school choices for Spell Focus", () => {
    const options = buildFeatPickerOptions({
      featRegistry: FEATS,
      featContext: FEAT_CONTEXT,
      grantKind: "general",
      takenSelections: [],
      query: "Spell Focus",
    });

    expect(options.map((option) => option.name)).toContain(
      "Spell Focus (Evocation)",
    );
    expect(options.map((option) => option.name)).toContain(
      "Spell Focus (Necromancy)",
    );
    expect(
      options.find((option) => option.name === "Spell Focus (Evocation)")?.tags,
    ).toContain("ready");
  });

  it("checks Greater Spell Focus against the matching school choice", () => {
    const options = buildFeatPickerOptions({
      featRegistry: FEATS,
      featContext: {
        ...FEAT_CONTEXT,
        featNames: ["Spell Focus (Evocation)"],
      },
      grantKind: "general",
      takenSelections: ["Spell Focus (Evocation)"],
      query: "Greater Spell Focus",
    });

    expect(
      options.find(
        (option) => option.name === "Greater Spell Focus (Evocation)",
      )?.tags,
    ).toContain("ready");
    expect(
      options.find(
        (option) => option.name === "Greater Spell Focus (Conjuration)",
      )?.tags,
    ).toContain("unmet");
  });
});
