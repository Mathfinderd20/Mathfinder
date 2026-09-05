import { describe, expect, it } from "vitest";
import { weaponTemplateLabel } from "./weaponUx";

describe("weaponTemplateLabel", () => {
  it("shows price and weight for weapon selectors", () => {
    expect(
      weaponTemplateLabel({
        name: "Heavy Crossbow",
        costGp: 50,
        weightLb: 8,
      }),
    ).toBe("Heavy Crossbow — 50 gp · 8 lb");
  });

  it("keeps fractional campaign-rule prices readable", () => {
    expect(
      weaponTemplateLabel({
        name: "Pistol",
        costGp: 100.5,
        weightLb: 4,
      }),
    ).toBe("Pistol — 100.5 gp · 4 lb");
  });
});
