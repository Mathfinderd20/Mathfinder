import { describe, expect, it } from "vitest";
import {
  appendCombatEvent,
  createRuntimeStateSnapshot,
  normalizeAmmoType,
  recordWeaponAttack,
  reduceRuntimeState,
  weaponTargetsDefense,
  resetLedger,
  setWeaponAttackNote,
  setWeaponAttackOutcome,
  undoWeaponAttack,
  updateLedger,
} from "../src";

describe("runtime reducer + helpers", () => {
  it("updates and resets ledgers safely", () => {
    expect(updateLedger({ arrow: 2 }, "arrow", 3).arrow).toBe(5);
    expect(updateLedger({ arrow: 2 }, "arrow", -10).arrow).toBe(0);
    expect(resetLedger({ arrow: 4 }, "arrow").arrow).toBe(0);
    expect(resetLedger({ arrow: 4 })).toEqual({});
  });

  it("records and undoes weapon attacks with ammo + events", () => {
    const recorded = recordWeaponAttack({
      history: {},
      events: [],
      ammoLedger: {},
      weaponKey: "longbow#1",
      weaponName: "Longbow",
      ammoType: "arrows",
      ammoSpentForAttack: 1,
    });
    expect(recorded.ammoLedger.arrow).toBe(1);
    expect(recorded.history["longbow#1"]).toHaveLength(1);
    expect(recorded.events).toHaveLength(1);

    const undone = undoWeaponAttack({
      history: recorded.history,
      events: recorded.events,
      ammoLedger: recorded.ammoLedger,
      weaponKey: "longbow#1",
      weaponName: "Longbow",
    });
    expect(undone?.ammoLedger.arrow).toBe(0);
    expect(undone?.history["longbow#1"]).toHaveLength(0);
    expect(undone?.events).toHaveLength(2);
  });

  it("caps per-weapon attack history alongside the event log", () => {
    let runtime = {
      history: {},
      events: [],
      ammoLedger: {},
    } as Pick<
      ReturnType<typeof recordWeaponAttack>,
      "history" | "events" | "ammoLedger"
    >;
    for (let index = 0; index < 3; index += 1) {
      runtime = recordWeaponAttack({
        ...runtime,
        weaponKey: "bow#1",
        weaponName: "Shortbow",
        eventHistoryLimit: 2,
      });
    }
    expect(runtime.history["bow#1"]).toHaveLength(2);
    expect(runtime.events).toHaveLength(2);
  });

  it("updates attack notes/outcomes and appends combat events", () => {
    const recorded = recordWeaponAttack({
      history: {},
      events: [],
      ammoLedger: {},
      weaponKey: "axe#1",
      weaponName: "Greataxe",
    });
    const attackId = recorded.history["axe#1"]?.[0]?.id;
    expect(attackId).toBeTruthy();
    const noted = setWeaponAttackNote(
      recorded.history,
      recorded.events,
      "axe#1",
      attackId!,
      "  big swing  ",
    );
    const tagged = setWeaponAttackOutcome(
      noted.history,
      noted.events,
      "axe#1",
      attackId!,
      "crit",
    );
    expect(tagged.history["axe#1"]?.[0]?.note).toBe("big swing");
    expect(tagged.history["axe#1"]?.[0]?.outcome).toBe("crit");
    expect(tagged.events[0]?.outcome).toBe("crit");
    expect(appendCombatEvent([], { kind: "reset-ammo" })).toHaveLength(1);
  });

  it("reduces current tracked runtime actions", () => {
    let state = createRuntimeStateSnapshot();
    state = reduceRuntimeState(state, {
      type: "set-toggle",
      id: "rage",
      value: true,
    });
    state = reduceRuntimeState(state, {
      type: "adjust-resource",
      id: "rage",
      delta: 2,
      max: 10,
    });
    state = reduceRuntimeState(state, {
      type: "cast-spell",
      classKey: "wizard",
      level: 1,
      max: 3,
      spellName: "Mage Armor",
      remaining: 3,
      spellEffectId: "mage-armor",
    });
    state = reduceRuntimeState(state, {
      type: "record-weapon-attack",
      weaponKey: "bow#1",
      weaponName: "Shortbow",
      ammoType: "arrows",
      ammoSpentForAttack: 1,
    });
    state = reduceRuntimeState(state, {
      type: "consume-spell-component",
      spellName: "Mage Armor",
      itemName: "Scroll of Mage Armor",
    });
    state = reduceRuntimeState(state, {
      type: "set-flag",
      key: "fatigued",
      value: true,
    });
    expect(state.toggles.rage).toBe(false);
    expect(state.toggles["mage-armor"]).toBe(true);
    expect(state.resources.rage).toBe(2);
    expect(state.slotUsage.wizard?.[1]).toBe(1);
    expect(state.collections.wizard?.[1]?.["Mage Armor"]).toBe(1);
    expect(state.ledgers.arrow).toBe(1);
    expect(state.histories["bow#1"]).toHaveLength(1);
    expect(state.events.some((event) => event.kind === "cast-spell")).toBe(
      true,
    );
    const latestEvent = state.events[state.events.length - 1];
    expect(latestEvent?.kind).toBe("consume-spell-component");
    expect(latestEvent?.itemName).toBe("Scroll of Mage Armor");
    expect(state.flags.fatigued).toBe(true);
    expect(normalizeAmmoType("Arrows")).toBe("arrow");
    expect(normalizeAmmoType("Shotgun Shells")).toBe("shotgun shell");
    expect(normalizeAmmoType("Alchemical Gas")).toBe("alchemical gas");
  });

  it("rejects duplicate spell casts when a stale UI count says slots remain", () => {
    const cast = {
      type: "cast-spell" as const,
      classKey: "wizard",
      level: 1,
      max: 1,
      spellName: "Mage Armor",
      remaining: 1,
    };
    const once = reduceRuntimeState(createRuntimeStateSnapshot(), cast);
    const twice = reduceRuntimeState(once, cast);

    expect(twice.slotUsage.wizard?.[1]).toBe(1);
    expect(twice.collections.wizard?.[1]?.["Mage Armor"]).toBe(1);
    expect(
      twice.events.filter((event) => event.kind === "cast-spell"),
    ).toHaveLength(1);
  });

  it("auto-consumes one-shot spell effects on tracked weapon attacks", () => {
    let state = createRuntimeStateSnapshot({
      toggles: { "spell-true-strike": true, "spell-guidance": true },
      resources: { "spell-true-strike": 0, "spell-guidance": 0 },
    });
    state = reduceRuntimeState(state, {
      type: "record-weapon-attack",
      weaponKey: "sword#1",
      weaponName: "Longsword",
    });
    expect(state.toggles["spell-true-strike"]).toBe(false);
    expect(state.toggles["spell-guidance"]).toBe(false);
    expect(state.resources["spell-true-strike"]).toBe(1);
    expect(state.resources["spell-guidance"]).toBe(1);
    expect(
      state.events.filter((event) => event.kind === "consume-spell-effect"),
    ).toHaveLength(2);
  });

  it("routes typed incoming damage through spell buffers before hp", () => {
    let state = createRuntimeStateSnapshot({
      toggles: {
        "spell-stoneskin": true,
        "spell-protection-from-energy": true,
      },
      resources: {
        tempHp: 4,
        "spell-stoneskin": 0,
        "spell-protection-from-energy": 0,
        hp: 0,
      },
    });
    state = reduceRuntimeState(state, {
      type: "apply-damage",
      amount: 12,
      damageType: "physical",
      hpDamageResourceId: "hp",
      tempHpResourceId: "tempHp",
      spellAbsorptions: [
        {
          effectId: "spell-stoneskin",
          effectName: "Stoneskin",
          max: 100,
          perHitMaximum: 10,
        },
      ],
    });
    expect(state.resources["spell-stoneskin"]).toBe(10);
    expect(state.resources.tempHp).toBe(2);
    expect(state.resources.hp).toBe(0);
    expect(state.toggles["spell-stoneskin"]).toBe(true);

    state = reduceRuntimeState(state, {
      type: "apply-damage",
      amount: 9,
      damageType: "fire",
      hpDamageResourceId: "hp",
      tempHpResourceId: "tempHp",
      spellAbsorptions: [
        {
          effectId: "spell-protection-from-energy",
          effectName: "Protection from Energy",
          max: 12,
        },
      ],
    });
    expect(state.resources["spell-protection-from-energy"]).toBe(9);
    expect(state.resources.tempHp).toBe(2);
    expect(state.resources.hp).toBe(0);
    expect(state.events.some((event) => event.kind === "apply-damage")).toBe(
      true,
    );
  });

  it("only breaks stabilization when damage reaches HP or temporary HP", () => {
    const protectedState = reduceRuntimeState(
      createRuntimeStateSnapshot({
        flags: { stable: true },
        toggles: { protection: true },
        resources: { protection: 0, hp: 0 },
      }),
      {
        type: "apply-damage",
        amount: 5,
        hpDamageResourceId: "hp",
        spellAbsorptions: [{ effectId: "protection", max: 10 }],
      },
    );
    expect(protectedState.flags.stable).toBe(true);
    expect(protectedState.resources.hp).toBe(0);

    const tempHpState = reduceRuntimeState(
      createRuntimeStateSnapshot({
        flags: { stable: true },
        resources: { temp: 5, hp: 0 },
      }),
      {
        type: "apply-damage",
        amount: 3,
        hpDamageResourceId: "hp",
        tempHpResourceId: "temp",
      },
    );
    expect(tempHpState.flags.stable).toBe(false);
    expect(tempHpState.resources.temp).toBe(2);
    expect(tempHpState.resources.hp).toBe(0);
  });

  it("selects touch AC for firearms within their first range increment", () => {
    expect(
      weaponTargetsDefense({
        targetsTouchAcWithinFirstRangeIncrement: true,
        rangeIncrementFeet: 20,
        rangeFeet: 20,
      }),
    ).toBe("touch-ac");
    expect(
      weaponTargetsDefense({
        targetsTouchAcWithinFirstRangeIncrement: true,
        rangeIncrementFeet: 20,
        rangeFeet: 21,
      }),
    ).toBe("normal-ac");
    expect(
      weaponTargetsDefense({
        targetsTouchAcWithinFirstRangeIncrement: false,
        rangeIncrementFeet: 20,
        rangeFeet: 10,
      }),
    ).toBe("normal-ac");
    expect(
      weaponTargetsDefense({
        targetsTouchAcWithinFirstRangeIncrement: true,
        rangeIncrementFeet: 20,
      }),
    ).toBe("touch-ac");
  });
});
