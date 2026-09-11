import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FavoredClassBonusOption } from "../favoredClassBonusData";
import { FavoredClassBonusPicker } from "./FavoredClassBonusPicker";

const noop = () => undefined;

function renderSelected(option: FavoredClassBonusOption) {
  return renderToStaticMarkup(
    <FavoredClassBonusPicker
      options={[option]}
      value={option.value}
      detailValue={undefined}
      radioName="test-favored-class"
      onChange={noop}
      onDetailChange={noop}
    />,
  );
}

describe("FavoredClassBonusPicker", () => {
  it("renders terrain choices required by a parameterized bonus", () => {
    const markup = renderSelected({
      value: "terrain",
      label: "Terrain magic",
      description: "Choose a terrain.",
      detail: {
        label: "Chosen favored terrain",
        control: "select",
        options: ["Forest", "Urban"],
      },
    });

    expect(markup).toContain("Chosen favored terrain");
    expect(markup).toContain("Forest");
    expect(markup).toContain("Urban");
    expect(markup).toContain("This bonus requires a choice.");
  });

  it("renders a bloodline-power field required by the selected bonus", () => {
    const markup = renderSelected({
      value: "bloodline",
      label: "Bloodline uses",
      description: "Choose a bloodline power.",
      detail: { label: "Chosen bloodline power", control: "text" },
    });

    expect(markup).toContain("Chosen bloodline power");
    expect(markup).toContain('placeholder="Enter the bloodline power"');
  });
});
