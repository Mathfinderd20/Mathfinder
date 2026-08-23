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

  it("shows a temporary weapon field while Weapon Focus needs a choice", () => {
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

  it("collapses a completed weapon choice into a compact summary", () => {
    const markup = renderToStaticMarkup(
      <FeatSelectionPicker
        value="Weapon Focus (Adam's Custom Gun)"
        onChange={() => undefined}
        featRegistry={FEATS}
        grantKind="fighter-bonus"
        availableWeaponNames={["Adam's Custom Gun"]}
      />,
    );
    expect(markup).toContain("Adam&#x27;s Custom Gun");
    expect(markup).toContain("Change");
    expect(markup).not.toContain("Choose weapon");
  });
});
