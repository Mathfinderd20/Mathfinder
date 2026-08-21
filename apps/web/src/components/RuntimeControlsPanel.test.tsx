import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuntimeControlsPanel } from "./RuntimeControlsPanel";

const NOOP = () => undefined;
const fighterProfile = {
  classNames: ["fighter"],
  meleeFocus: true,
  rangedFocus: false,
  casterFocus: false,
  strengthScore: 16,
  dexScore: 12,
  conScore: 14,
};
const haste = {
  id: "haste",
  name: "Haste",
  description: "A useful spell effect.",
  modifiers: [{ target: "attack", value: 1, source: "Haste" }],
};

function renderPanel(ownedSpellNames: string[]) {
  return renderToStaticMarkup(
    <RuntimeControlsPanel
      activatableGroups={{ ungrouped: [], grouped: {} }}
      activatableConflicts={[]}
      activeBuffs={{}}
      resourcesUsed={{}}
      resourceMaxes={{}}
      resourceLabels={{}}
      fatigued={false}
      buffs={[haste]}
      ownedSpellNames={ownedSpellNames}
      profile={fighterProfile}
      onSetToggle={NOOP}
      onSetExclusiveToggleGroup={NOOP}
      onSetFlag={NOOP}
      onAdjustResource={NOOP}
      onResetResource={NOOP}
    />,
  );
}

describe("RuntimeControlsPanel", () => {
  it("does not promote unowned spells on a fighter by default", () => {
    const html = renderPanel([]);
    expect(html).not.toContain("<strong>Haste</strong>");
    expect(html).toContain("Show 1 More Effects");
  });

  it("keeps owned spells visible", () => {
    expect(renderPanel(["Haste"])).toContain("<strong>Haste</strong>");
  });
});
