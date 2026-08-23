import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FEATS } from "@mathfinder/rules-engine";
import {
  buildBaseFeatOptions,
  FeatSelectionPicker,
} from "./FeatSelectionPicker";

describe("FeatSelectionPicker", () => {
  it("lists Weapon Focus once instead of once per weapon", () => {
    const options = buildBaseFeatOptions(FEATS, "fighter-bonus");
    expect(
      options.filter((option) => option.name === "Weapon Focus"),
    ).toHaveLength(1);
    expect(
      options.some((option) => option.name.includes("Weapon Focus (")),
    ).toBe(false);
  });

  it("shows a separate weapon field after Weapon Focus is selected", () => {
    const markup = renderToStaticMarkup(
      <FeatSelectionPicker
        value="Weapon Focus"
        onChange={() => undefined}
        featRegistry={FEATS}
        grantKind="fighter-bonus"
        availableWeaponNames={["Adam's Custom Gun"]}
      />,
    );
    expect(markup).toContain("Weapon");
    expect(markup).toContain("Choose weapon");
  });
});
