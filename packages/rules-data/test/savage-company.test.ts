import { describe, expect, it } from "vitest";
import { SAVAGE_COMPANY_CLASS_FEATURES } from "../src/data/savage-company/class-features";
import { SAVAGE_COMPANY_CLASSES } from "../src/data/savage-company/classes";

describe("Savage Company firearm support scaffolding", () => {
  it("gives Infantryman real firearm proficiencies instead of placeholder notes", () => {
    const infantryman = SAVAGE_COMPANY_CLASSES.find(
      (entry) => entry.name === "Infantryman",
    );
    expect(infantryman?.specificWeaponProficiencies).toEqual([
      "Pistol",
      "Musket",
      "Blunderbuss",
    ]);
  });

  it("models both Infantryman's Dodge reactions as exclusive ranged AC modes", () => {
    const dodgeModes = SAVAGE_COMPANY_CLASS_FEATURES.filter((feature) =>
      feature.id.startsWith("infantryman-dodge-"),
    );
    expect(dodgeModes).toHaveLength(2);
    expect(dodgeModes.map((feature) => feature.activatable?.group)).toEqual([
      "infantryman-dodge",
      "infantryman-dodge",
    ]);
    expect(
      dodgeModes.map((feature) => feature.activatable?.effects[0]?.target),
    ).toEqual(["ac.vs.ranged", "ac.vs.ranged"]);
  });
});
