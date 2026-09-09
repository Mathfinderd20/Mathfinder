import { describe, expect, it } from "vitest";
import { weaponAttackResults } from "./weaponAttackResults";
import { attackResultDetail } from "./components/CombatLogPanel";
import { createAppRuntimeState, loadAppRuntimeState } from "./runtimeState";
import { reduceRuntimeState } from "@mathfinder/rules-engine";

describe("recorded attack results", () => {
  it("snapshots attack and damage totals with their current bonuses", () => {
    expect(weaponAttackResults("12", "4", 6, 5, 2)).toEqual({
      attackRoll: 12,
      attackTotal: 18,
      damageRoll: 4,
      damageTotal: 9,
      criticalMultiplier: 2,
    });
  });
  it("does not invent rolls for empty or invalid input and preserves zero", () => {
    expect(weaponAttackResults("", "Infinity", 6, 5, 2)).toEqual({
      criticalMultiplier: 2,
    });
    expect(weaponAttackResults("0", "0", -2, 0, 2)).toMatchObject({
      attackTotal: -2,
      damageTotal: 0,
    });
  });
  it("keeps totals through save/reload, notes, and hit/miss/crit updates", () => {
    let state = reduceRuntimeState(createAppRuntimeState(), {
      type: "record-weapon-attack",
      weaponKey: "sword",
      weaponName: "Sword",
      rolls: weaponAttackResults("12", "4", 6, 5, 2),
    });
    state = loadAppRuntimeState(JSON.stringify(state));
    expect(state.histories.sword?.[0]?.rolls).toEqual(state.events[0]?.rolls);
    state = reduceRuntimeState(state, {
      type: "set-latest-weapon-attack-note",
      weaponKey: "sword",
      note: "First target",
    });
    for (const outcome of ["hit", "miss", "crit"] as const) {
      state = reduceRuntimeState(state, {
        type: "set-latest-weapon-attack-outcome",
        weaponKey: "sword",
        outcome,
      });
      const event = state.events[0];
      if (!event) throw new Error("Attack event missing");
      expect(event.outcome).toBe(outcome);
      expect(event.note).toBe("First target");
      expect(attackResultDetail(event)).toContain("Attack 18 (roll 12)");
      expect(attackResultDetail(event)).toContain(
        `Damage ${outcome === "crit" ? 18 : 9} (roll 4`,
      );
    }
  });
  it("leaves historical attacks without rolls readable", () => {
    expect(
      attackResultDetail({ id: "old", at: "2026-09-09", kind: "attack" }),
    ).toBe("Roll results not recorded");
    expect(
      attackResultDetail({
        id: "hp",
        at: "2026-09-09",
        kind: "apply-damage",
        quantity: 5,
      }),
    ).toBeNull();
  });
});
