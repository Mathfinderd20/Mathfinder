import { describe, expect, it } from "vitest";
import {
  createRuntimeStateSnapshot,
  reduceRuntimeState,
} from "@mathfinder/rules-engine";
import {
  directHpLossRuntimeActions,
  healingRuntimeActions,
  resetHealthRuntimeActions,
} from "./runtimeMutations";

function apply(actions: ReturnType<typeof resetHealthRuntimeActions>) {
  return reduceRuntimeState(createRuntimeStateSnapshot(), {
    type: "batch",
    actions,
  });
}

describe("runtime mutation bundles", () => {
  it("applies healing and stabilization as one reducer action", () => {
    const state = reduceRuntimeState(
      createRuntimeStateSnapshot({
        resources: { "hp-damage": 15 },
        flags: { stable: false },
      }),
      {
        type: "batch",
        actions: healingRuntimeActions({
          amount: 3,
          currentHp: -5,
          maxHp: 10,
          dead: false,
        }),
      },
    );
    expect(state.resources["hp-damage"]).toBe(12);
    expect(state.flags.stable).toBe(true);
  });

  it("ignores healing for dead characters", () => {
    expect(
      healingRuntimeActions({
        amount: 10,
        currentHp: -20,
        maxHp: 10,
        dead: true,
      }),
    ).toEqual([]);
  });

  it("marks direct hp loss unstable", () => {
    const state = apply(directHpLossRuntimeActions(4));
    expect(state.resources["hp-damage"]).toBe(4);
    expect(state.flags.stable).toBe(false);
  });

  it("resets every health resource and survival flag", () => {
    const populated = createRuntimeStateSnapshot({
      resources: {
        "hp-damage": 7,
        "temp-hp": 3,
        "nonlethal-damage": 2,
      },
      flags: {
        stable: true,
        "diehard-active": true,
        "ferocity-active": true,
        "ferocity-used": true,
      },
    });
    const state = reduceRuntimeState(populated, {
      type: "batch",
      actions: resetHealthRuntimeActions(),
    });
    expect(state.resources).toMatchObject({
      "hp-damage": 0,
      "temp-hp": 0,
      "nonlethal-damage": 0,
    });
    expect(state.flags).toMatchObject({
      stable: false,
      "diehard-active": false,
      "ferocity-active": false,
      "ferocity-used": false,
    });
  });
});
