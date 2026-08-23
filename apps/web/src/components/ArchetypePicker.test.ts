import { describe, expect, it } from "vitest";
import type { ArchetypeDefinitionLike } from "@mathfinder/rules-engine";
import { filterArchetypes } from "./ArchetypePicker";

const ARCHETYPES: ArchetypeDefinitionLike[] = [
  {
    id: "archer",
    name: "Archer",
    baseClassName: "Fighter",
    description: "A master of ranged combat and bows.",
    replaces: ["Bravery"],
  },
  {
    id: "armiger",
    name: "Armiger",
    baseClassName: "Fighter",
    description: "An armored defensive specialist.",
    alters: ["Armor Training"],
  },
];

describe("filterArchetypes", () => {
  it("finds multiple readable results by rules text", () => {
    expect(filterArchetypes(ARCHETYPES, "ar").map((item) => item.name)).toEqual(
      ["Archer", "Armiger"],
    );
    expect(filterArchetypes(ARCHETYPES, "armor training")[0]?.name).toBe(
      "Armiger",
    );
    expect(filterArchetypes(ARCHETYPES, "bravery")[0]?.name).toBe("Archer");
  });

  it("keeps the catalog hidden before a search", () => {
    expect(filterArchetypes(ARCHETYPES, "   ")).toEqual([]);
  });
});
