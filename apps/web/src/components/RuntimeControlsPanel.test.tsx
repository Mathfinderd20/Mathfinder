import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DerivedResourcePool } from "@mathfinder/rules-engine";
import {
  activatableResourceFailure,
  resourcePoolMathTooltip,
  RuntimeControlsPanel,
} from "./RuntimeControlsPanel";

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

function renderPanel(
  ownedSpellNames: string[],
  resourcePools: DerivedResourcePool[] = [],
) {
  return renderToStaticMarkup(
    <RuntimeControlsPanel
      activatableGroups={{ ungrouped: [], grouped: {} }}
      activatableConflicts={[]}
      activatableBlockedReasons={{}}
      activeBuffs={{}}
      resourcesUsed={{}}
      resourceMaxes={Object.fromEntries(
        resourcePools.map((pool) => [pool.id, pool.max]),
      )}
      resourceLabels={Object.fromEntries(
        resourcePools.map((pool) => [pool.id, pool.unit]),
      )}
      resourcePools={resourcePools}
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

describe("activatable resource costs", () => {
  const deed = {
    id: "dodge",
    name: "Dodge",
    description: "Spend grit.",
    resourceCost: { poolId: "infantryman-grit", amount: 1 },
  };

  it("blocks a deed when its pool is empty", () => {
    expect(
      activatableResourceFailure(
        deed,
        { "infantryman-grit": 1 },
        { "infantryman-grit": 1 },
        { "infantryman-grit": "grit" },
      ),
    ).toBe("requires 1 grit (0 remaining)");
  });

  it("allows a deed while enough resource remains", () => {
    expect(
      activatableResourceFailure(
        deed,
        { "infantryman-grit": 2 },
        { "infantryman-grit": 1 },
        { "infantryman-grit": "grit" },
      ),
    ).toBeUndefined();
  });
});

describe("RuntimeControlsPanel", () => {
  it("does not promote unowned spells on a fighter by default", () => {
    const html = renderPanel([]);
    expect(html).not.toContain("<strong>Haste</strong>");
    expect(html).toContain("Show 1 More Effects");
  });

  it("keeps owned spells visible", () => {
    expect(renderPanel(["Haste"])).toContain("<strong>Haste</strong>");
  });

  it("renders standalone class resource pools without an ability toggle", () => {
    const html = renderPanel(
      [],
      [
        {
          id: "infantryman-grit",
          name: "Grit",
          unit: "grit",
          description: "Spend grit on deeds.",
          max: 3,
          calculation: {
            contributions: [{ label: "WIS modifier", value: 3 }],
            rawTotal: 3,
            minimum: 1,
            total: 3,
          },
        },
      ],
    );
    expect(html).toContain("resource pools");
    expect(html).toContain("3/3 grit");
    expect(html).toContain("Spend");
    expect(html).toContain("Regain");
    expect(html).not.toContain("Grit (ability)");
  });

  it("explains grit maximum math for hover and keyboard focus", () => {
    expect(
      resourcePoolMathTooltip({
        id: "infantryman-grit",
        name: "Grit",
        unit: "grit",
        description: "Spend grit on deeds.",
        max: 5,
        calculation: {
          contributions: [
            { label: "WIS modifier", value: 3 },
            { label: "Extra Grit", value: 2 },
          ],
          rawTotal: 5,
          minimum: 1,
          total: 5,
        },
      }),
    ).toBe("Grit maximum: WIS modifier 3 + Extra Grit 2 = 5. Total 5.");
  });
});
