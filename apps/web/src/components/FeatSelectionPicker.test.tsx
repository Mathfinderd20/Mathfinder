import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FEATS } from "@mathfinder/rules-engine";
import {
  beginFeatSelection,
  buildBaseFeatOptions,
  featSelectionIsComplete,
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

  it("keeps parameterized feats pending but commits ordinary feats immediately", () => {
    expect(beginFeatSelection(FEATS, "Weapon Focus", "")).toEqual({
      committedValue: "",
      pendingFeatName: "Weapon Focus",
    });
    expect(beginFeatSelection(FEATS, "Power Attack", "")).toEqual({
      committedValue: "Power Attack",
    });
  });

  it("does not treat an incomplete parameterized feat as selected", () => {
    expect(featSelectionIsComplete(FEATS, "Weapon Focus")).toBe(false);
    const markup = renderToStaticMarkup(
      <FeatSelectionPicker
        value="Weapon Focus"
        onChange={() => undefined}
        featRegistry={FEATS}
        grantKind="fighter-bonus"
        availableWeaponNames={["Adam's Custom Gun"]}
      />,
    );
    expect(markup).not.toContain("Choose weapon");
  });

  it("collapses a completed weapon choice into a compact summary", () => {
    expect(
      featSelectionIsComplete(FEATS, "Weapon Focus (Adam's Custom Gun)"),
    ).toBe(true);
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
