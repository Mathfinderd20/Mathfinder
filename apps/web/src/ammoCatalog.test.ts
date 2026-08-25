import { describe, expect, it } from "vitest";
import {
  ammoStackCostGp,
  ammoStackWeightLb,
  ammoUsesFirearmRules,
} from "./ammoCatalog";
import { createAmmoStack } from "./equipmentTools";

describe("campaign-aware ammunition pricing", () => {
  it("stores per-round cost and weight instead of multiplying stack totals", () => {
    expect(ammoStackCostGp("bullet")).toBe(10);
    expect(ammoStackWeightLb("bullet")).toBe(0.1);
    expect(createAmmoStack("bullet")).toMatchObject({
      quantity: 10,
      costGp: 10,
      weight: 0.1,
    });
  });

  it("discounts firearm ammunition but not arrows under Guns Everywhere", () => {
    const rules = { firearmRules: "guns-everywhere" as const };
    expect(ammoUsesFirearmRules("bullet")).toBe(true);
    expect(ammoStackCostGp("bullet", rules)).toBe(1);
    expect(ammoUsesFirearmRules("arrow")).toBe(false);
    expect(ammoStackCostGp("arrow", rules)).toBe(0.05);
  });
});
