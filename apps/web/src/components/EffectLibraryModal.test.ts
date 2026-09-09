import { describe, expect, it } from "vitest";
import {
  filterEffectLibrary,
  type EffectLibraryFilters,
} from "./EffectLibraryModal";
const profile = {
  classNames: ["fighter"],
  meleeFocus: true,
  rangedFocus: false,
  casterFocus: false,
  strengthScore: 16,
  dexScore: 12,
  conScore: 14,
};
const buffs = [
  {
    id: "bless",
    name: "Bless",
    description: "Ally morale attack bonus",
    modifiers: [
      { target: "attack", type: "morale", value: 1, source: "Bless" },
    ],
  },
  {
    id: "haste",
    name: "Haste",
    description: "Move faster",
    trackerMax: 1,
    limitations: ["Extra attack handled manually"],
    modifiers: [
      { target: "speed", type: "enhancement", value: 30, source: "Haste" },
    ],
  },
];
const filters: EffectLibraryFilters = {
  search: "",
  category: "",
  target: "",
  bonus: "",
  tracking: "",
  ownership: "",
  letter: "",
};
describe("effect library filters", () => {
  it("combines text, bonus, target, and A-Z filters", () => {
    expect(
      filterEffectLibrary(buffs, profile, [], [], {
        ...filters,
        search: "morale",
        bonus: "morale",
        target: "attack",
        letter: "B",
      }).map((buff) => buff.id),
    ).toEqual(["bless"]);
  });
  it("distinguishes retained, available, known, and tracked effects", () => {
    expect(
      filterEffectLibrary(buffs, profile, ["Haste"], ["bless"], {
        ...filters,
        ownership: "available",
      }).map((buff) => buff.id),
    ).toEqual(["haste"]);
    expect(
      filterEffectLibrary(buffs, profile, ["Haste"], ["bless"], {
        ...filters,
        ownership: "added",
      }).map((buff) => buff.id),
    ).toEqual(["bless"]);
    expect(
      filterEffectLibrary(buffs, profile, ["Haste"], [], {
        ...filters,
        ownership: "known",
        tracking: "tracked",
      }).map((buff) => buff.id),
    ).toEqual(["haste"]);
  });
});
