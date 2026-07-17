import { describe, expect, it } from "vitest";
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
});
