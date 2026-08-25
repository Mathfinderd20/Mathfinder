import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  activatableResourceFailure,
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
  resourcePools: Array<{
    id: string;
    name: string;
    unit: string;
    description: string;
    max: number;
  }> = [],
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
        },
      ],
    );
    expect(html).toContain("resource pools");
    expect(html).toContain("3/3 grit");
    expect(html).toContain("Spend");
    expect(html).toContain("Regain");
    expect(html).not.toContain("Grit (ability)");
  });
});
