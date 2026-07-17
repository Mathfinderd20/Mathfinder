import { describe, expect, it } from "vitest";
import { createAppRuntimeState, loadAppRuntimeState } from "./runtimeState";

describe("runtimeState migration helpers", () => {
  it("loads legacy runtime snapshots into the shared shape", () => {
    const state = loadAppRuntimeState(
      JSON.stringify({
        activeBuffs: { rage: true },
        resourcesUsed: { rage: 2 },
        fatigued: true,
        ammoSpent: { arrow: 3 },
      }),
    );
    expect(state.toggles.rage).toBe(true);
    expect(state.resources.rage).toBe(2);
    expect(state.flags.fatigued).toBe(true);
    expect(state.ledgers.arrow).toBe(3);
  });

  it("creates empty app runtime state by default", () => {
    const state = createAppRuntimeState();
    expect(state.toggles).toEqual({});
    expect(state.events).toEqual([]);
  });
});
