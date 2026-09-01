import { describe, expect, it } from "vitest";
import {
  searchCompendiumOptions,
  type CompendiumOption,
} from "./CompendiumPicker";

const OPTIONS: CompendiumOption[] = [
  {
    id: "ring-of-wizardry-i",
    name: "Ring of Wizardry I",
    pack: "core",
    source: "Core Rulebook",
    tags: ["arcane", "ring"],
    searchText: "doubles first-level spell slots",
  },
  {
    id: "cloak-of-resistance-1",
    name: "Cloak of Resistance +1",
    pack: "ultimate-equipment",
    source: "Ultimate Equipment",
    tags: ["saves", "shoulders"],
  },
];

describe("CompendiumPicker search", () => {
  it("uses shared compendium metadata fields", () => {
    expect(searchCompendiumOptions(OPTIONS, "ultimate")[0]?.id).toBe(
      "cloak-of-resistance-1",
    );
    expect(searchCompendiumOptions(OPTIONS, "arcane")[0]?.id).toBe(
      "ring-of-wizardry-i",
    );
  });

  it("includes picker-specific rules text", () => {
    expect(searchCompendiumOptions(OPTIONS, "spell slots")[0]?.id).toBe(
      "ring-of-wizardry-i",
    );
  });

  it("returns the full catalog for an empty query", () => {
    expect(searchCompendiumOptions(OPTIONS, "   ")).toEqual(OPTIONS);
  });
});
