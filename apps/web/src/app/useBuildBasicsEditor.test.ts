import { describe, expect, it } from "vitest";
import {
  withFirearmRulesMode,
  withIgnoreAlignmentRestrictions,
  withIgnoreEncumbrance,
} from "./useBuildBasicsEditor";

describe("campaign house-rule updates", () => {
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
