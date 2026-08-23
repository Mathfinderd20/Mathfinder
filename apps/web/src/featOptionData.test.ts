import { describe, expect, it } from "vitest";
import { FEATS, type FeatContext } from "@mathfinder/rules-engine";
import {
  buildFeatPickerOptions,
  buildLooseFeatSearchOptions,
} from "./featOptionData";

const FEAT_CONTEXT: FeatContext = {
  baseAttackBonus: 1,
  abilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  characterLevel: 1,
  featNames: [],
};

describe("parameterized feat picker options", () => {
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
