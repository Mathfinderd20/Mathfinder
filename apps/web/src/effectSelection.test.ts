import { describe, expect, it } from "vitest";
import {
  createRuntimeStateSnapshot,
  reduceRuntimeState,
} from "@mathfinder/rules-engine";
import {
  selectEffectActions,
  retainedEffectKey,
  FATIGUED_EFFECT_ID,
} from "./effectSelection";

describe("effect shelf membership", () => {
  it("applies multiple effects atomically, retains disabled cards, and removes explicitly", () => {
    let state = createRuntimeStateSnapshot();
    state = reduceRuntimeState(state, {
      type: "batch",
      actions: selectEffectActions(["bless", "haste"], true),
    });
    expect(state.toggles.bless).toBe(true);
    expect(state.toggles.haste).toBe(true);
    state = reduceRuntimeState(state, {
      type: "batch",
      actions: selectEffectActions(["bless"], false),
    });
    expect(state.toggles.bless).toBe(false);
    expect(state.flags[retainedEffectKey("bless")]).toBe(true);
    const restored = createRuntimeStateSnapshot(
      JSON.parse(JSON.stringify(state)),
    );
    expect(restored.flags[retainedEffectKey("bless")]).toBe(true);
    state = reduceRuntimeState(state, {
      type: "batch",
      actions: selectEffectActions(["bless"], false, false),
    });
    expect(state.flags[retainedEffectKey("bless")]).toBe(false);
    expect(state.toggles.haste).toBe(true);
  });
  it("keeps fatigue's mechanical flag separate from the retained card", () => {
    const active = reduceRuntimeState(createRuntimeStateSnapshot(), {
      type: "batch",
      actions: selectEffectActions([FATIGUED_EFFECT_ID], true),
    });
    const inactive = reduceRuntimeState(active, {
      type: "batch",
      actions: selectEffectActions([FATIGUED_EFFECT_ID], false),
    });
    expect(inactive.flags.fatigued).toBe(false);
    expect(inactive.flags[retainedEffectKey(FATIGUED_EFFECT_ID)]).toBe(true);
  });
});
