import { describe, expect, it } from "vitest";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import {
  withDefaultInfantrymanGunTraining,
  withFirearmRulesMode,
  withIgnoreAlignmentRestrictions,
  withIgnoreEncumbrance,
} from "./useBuildBasicsEditor";

describe("campaign house-rule updates", () => {
  it("selects the sole owned firearm for level-1 Guns Everywhere training", () => {
    const build = {
      name: "Shooty",
      race: { name: "Human", size: "medium", speed: 30 },
      baseAbilityScores: {
        str: 10,
        dex: 16,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      levels: [{ className: "Infantryman", hitPointRoll: 10 }],
      campaignRules: { firearmRules: "guns-everywhere" },
    } as CharacterBuild;

    expect(withDefaultInfantrymanGunTraining(build, ["Pistol"])).toMatchObject({
      gunTrainingSelections: { infantryman: ["Pistol"] },
    });
    expect(withDefaultInfantrymanGunTraining(build, ["Pistol", "Musket"])).toBe(
      build,
    );
  });

  it("stores Commonplace Guns as an explicit campaign mode", () => {
    expect(withFirearmRulesMode(undefined, "commonplace-guns")).toEqual({
      firearmRules: "commonplace-guns",
    });
  });

  it("preserves alignment settings when firearm rules change", () => {
    expect(
      withFirearmRulesMode(
        { ignoreAlignmentRestrictions: true },
        "guns-everywhere",
      ),
    ).toEqual({
      firearmRules: "guns-everywhere",
      ignoreAlignmentRestrictions: true,
    });
    expect(
      withFirearmRulesMode(
        {
          firearmRules: "guns-everywhere",
          ignoreAlignmentRestrictions: true,
        },
        "standard",
      ),
    ).toEqual({ ignoreAlignmentRestrictions: true });
  });

  it("preserves firearm rules when alignment restrictions are toggled", () => {
    expect(
      withIgnoreAlignmentRestrictions(
        { firearmRules: "guns-everywhere" },
        true,
      ),
    ).toEqual({
      firearmRules: "guns-everywhere",
      ignoreAlignmentRestrictions: true,
    });
    expect(
      withIgnoreAlignmentRestrictions(
        {
          firearmRules: "guns-everywhere",
          ignoreAlignmentRestrictions: true,
        },
        false,
      ),
    ).toEqual({ firearmRules: "guns-everywhere" });
  });

  it("toggles encumbrance independently of other campaign rules", () => {
    const enabled = withIgnoreEncumbrance(
      {
        firearmRules: "guns-everywhere",
        ignoreAlignmentRestrictions: true,
      },
      true,
    );
    expect(enabled).toEqual({
      firearmRules: "guns-everywhere",
      ignoreAlignmentRestrictions: true,
      ignoreEncumbrance: true,
    });
    expect(withIgnoreEncumbrance(enabled, false)).toEqual({
      firearmRules: "guns-everywhere",
      ignoreAlignmentRestrictions: true,
    });
  });
});
