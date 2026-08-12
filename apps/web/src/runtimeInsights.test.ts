import { describe, expect, it } from "vitest";
import type { DerivedSpellcasting } from "@mathfinder/rules-engine";
import { collectOwnedSpellNames } from "./runtimeInsights";

describe("runtime spell effects", () => {
  it("collects known, prepared, granted, and library spells once", () => {
    const entries = [
      {
        grantedSpells: { 1: ["Bless"] },
        librarySpells: { 1: ["Mage Armor", "bless"] },
        selectedPreparedSpells: { 1: ["Shield"] },
        selectedKnownSpells: { 0: ["Light"] },
      },
    ] as unknown as DerivedSpellcasting[];

    expect(collectOwnedSpellNames(entries)).toEqual([
      "bless",
      "Light",
      "Mage Armor",
      "Shield",
    ]);
  });
});
